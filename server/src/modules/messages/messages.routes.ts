import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { isUserEmployedOnYmd, kstTodayYmd } from '../users/userEmployment.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';

const router = Router();

router.use(authMiddleware);

type PartnerRow = { id: string; name: string; role: string };

async function getEmployedStaffIds(): Promise<string[]> {
  const todayYmd = kstTodayYmd();
  const usersRaw = await prisma.user.findMany({
    where: { isActive: true, role: { in: ['ADMIN', 'MARKETER'] } },
    select: { id: true, hireDate: true, resignationDate: true },
  });
  return usersRaw.filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, todayYmd)).map((u) => u.id);
}

async function getEmployedTeamLeaderIds(): Promise<string[]> {
  const todayYmd = kstTodayYmd();
  const usersRaw = await prisma.user.findMany({
    where: { role: 'TEAM_LEADER', isActive: true },
    select: { id: true, hireDate: true, resignationDate: true },
  });
  return usersRaw.filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, todayYmd)).map((u) => u.id);
}

async function getEmployedExternalPartnerIds(): Promise<string[]> {
  const todayYmd = kstTodayYmd();
  const usersRaw = await prisma.user.findMany({
    where: { role: 'EXTERNAL_PARTNER', isActive: true },
    select: { id: true, hireDate: true, resignationDate: true },
  });
  return usersRaw.filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, todayYmd)).map((u) => u.id);
}

async function buildConversationList(myUserId: string, partners: PartnerRow[]) {
  if (partners.length === 0) return [];
  const partnerIds = partners.map((p) => p.id);
  const [allMessages, unreadBySender] = await Promise.all([
    prisma.message.findMany({
      where: {
        OR: [
          { senderId: myUserId, receiverId: { in: partnerIds } },
          { senderId: { in: partnerIds }, receiverId: myUserId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { content: true, createdAt: true, senderId: true, receiverId: true },
    }),
    prisma.message.groupBy({
      by: ['senderId'],
      where: { receiverId: myUserId, senderId: { in: partnerIds }, readAt: null },
      _count: { id: true },
    }),
  ]);
  const unreadMap = new Map(unreadBySender.map((u) => [u.senderId, u._count.id]));
  const lastByPartner = new Map<string, { content: string; createdAt: Date; senderId: string }>();
  for (const m of allMessages) {
    const partnerId = m.senderId === myUserId ? m.receiverId : m.senderId;
    if (!lastByPartner.has(partnerId)) lastByPartner.set(partnerId, m);
  }
  const list = partners.map((u) => ({
    ...u,
    lastMessage: lastByPartner.get(u.id) ?? null,
    unreadCount: unreadMap.get(u.id) ?? 0,
  }));
  /** 최근 대화가 위로 (새 메시지 온 팀장이 상단에 오도록) */
  list.sort((a, b) => {
    const ta = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
    const tb = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
    if (tb !== ta) return tb - ta;
    if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
    return a.name.localeCompare(b.name, 'ko');
  });
  return list;
}

/** 관리자·마케터: 팀장 목록 / 팀장: 관리자·마케터 목록 — N+1 최소화 */
router.get('/conversations', async (req, res) => {
  const { userId, role } = (req as unknown as { user: AuthPayload }).user;
  const todayYmd = kstTodayYmd();

  if (role === 'ADMIN' || role === 'MARKETER') {
    const usersRaw = await prisma.user.findMany({
      where: { role: { in: ['TEAM_LEADER', 'EXTERNAL_PARTNER'] }, isActive: true },
      select: {
        id: true,
        name: true,
        role: true,
        hireDate: true,
        resignationDate: true,
        externalCompany: { select: { name: true } },
      },
    });
    const users = usersRaw.filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, todayYmd));
    const partners: PartnerRow[] = users.map((u) => ({
      id: u.id,
      name: u.role === 'EXTERNAL_PARTNER' && u.externalCompany?.name ? `${u.name} (${u.externalCompany.name})` : u.name,
      role: u.role,
    }));
    const list = await buildConversationList(userId, partners);
    res.json(list);
    return;
  }

  if (role === 'TEAM_LEADER' || role === 'EXTERNAL_PARTNER') {
    const usersRaw = await prisma.user.findMany({
      where: {
        isActive: true,
        role: { in: ['ADMIN', 'MARKETER'] },
      },
      select: { id: true, name: true, role: true, hireDate: true, resignationDate: true },
    });
    const users = usersRaw.filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, todayYmd));
    const partners: PartnerRow[] = users.map((u) => ({ id: u.id, name: u.name, role: u.role }));
    const list = await buildConversationList(userId, partners);
    res.json(list);
    return;
  }

  res.status(403).json({ error: '메시지를 사용할 수 없습니다.' });
});

router.get('/unread-count', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const count = await prisma.message.count({
    where: { receiverId: userId, readAt: null },
  });
  res.json({ count });
});

/** 팀장: 운영(관리자·마케터)과의 통합 대화 (선택 없이 한 화면) */
router.get('/team-office', async (req, res) => {
  const { userId: myId, role } = (req as unknown as { user: AuthPayload }).user;
  if (role !== 'TEAM_LEADER' && role !== 'EXTERNAL_PARTNER') {
    res.status(403).json({ error: '팀장·타업체만 사용할 수 있습니다.' });
    return;
  }
  const staffIds = await getEmployedStaffIds();
  if (staffIds.length === 0) {
    res.json([]);
    return;
  }
  type TeamOfficeRow = {
    id: string;
    content: string;
    createdAt: Date;
    readAt: Date | null;
    senderId: string;
    receiverId: string;
    batchId: string | null;
    sender: { id: string; name: string };
  };
  const raw = (await prisma.message.findMany({
    where: {
      OR: [
        { senderId: myId, receiverId: { in: staffIds } },
        { senderId: { in: staffIds }, receiverId: myId },
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      content: true,
      createdAt: true,
      readAt: true,
      senderId: true,
      receiverId: true,
      batchId: true,
      sender: { select: { id: true, name: true } },
    },
  } as any)) as TeamOfficeRow[];
  await prisma.message.updateMany({
    where: { senderId: { in: staffIds }, receiverId: myId, readAt: null },
    data: { readAt: new Date() },
  });

  const seenBatch = new Set<string>();
  const collapsed: TeamOfficeRow[] = [];
  for (const m of raw) {
    if (m.senderId === myId && m.batchId) {
      if (seenBatch.has(m.batchId)) continue;
      seenBatch.add(m.batchId);
    }
    collapsed.push(m);
  }
  res.json(collapsed);
});

/** 팀장: 운영 전체(재직 관리자·마케터)에게 동일 내용 전송 — batchId로 묶음 */
router.post('/team-send', async (req, res) => {
  const { userId, role } = (req as unknown as { user: AuthPayload }).user;
  if (role !== 'TEAM_LEADER' && role !== 'EXTERNAL_PARTNER') {
    res.status(403).json({ error: '팀장·타업체만 전송할 수 있습니다.' });
    return;
  }
  const { content } = req.body as { content?: string };
  if (!content?.trim()) {
    res.status(400).json({ error: '내용을 입력해주세요.' });
    return;
  }
  const staffIds = await getEmployedStaffIds();
  if (staffIds.length === 0) {
    res.status(400).json({ error: '수신 가능한 운영 계정이 없습니다.' });
    return;
  }
  const batchId = randomUUID();
  const text = content.trim();
  const created = await prisma.$transaction(
    staffIds.map((receiverId) =>
      prisma.message.create({
        data: {
          senderId: userId,
          receiverId,
          content: text,
          batchId,
        } as any,
        include: {
          sender: { select: { id: true, name: true } },
          receiver: { select: { id: true, name: true } },
        },
      })
    )
  );
  const first = created[0] as
    | {
        id: string;
        content: string;
        createdAt: Date;
        batchId: string | null;
        sender: { id: string; name: string };
      }
    | undefined;
  res.status(201).json({
    batchId,
    recipientCount: created.length,
    sample: first
      ? {
          id: first.id,
          content: first.content,
          createdAt: first.createdAt,
          batchId: first.batchId,
          sender: first.sender,
        }
      : null,
  });
  notifyInboxRefresh([userId, ...staffIds]);
});

/** 관리자·마케터: 전체 팀장에게 공지(동일 내용) */
router.post('/broadcast-to-leaders', async (req, res) => {
  const { userId, role } = (req as unknown as { user: AuthPayload }).user;
  if (role !== 'ADMIN' && role !== 'MARKETER') {
    res.status(403).json({ error: '관리자·마케터만 전송할 수 있습니다.' });
    return;
  }
  const { content } = req.body as { content?: string };
  if (!content?.trim()) {
    res.status(400).json({ error: '내용을 입력해주세요.' });
    return;
  }
  const leaderIds = await getEmployedTeamLeaderIds();
  const partnerIds = await getEmployedExternalPartnerIds();
  const receiverIds = [...new Set([...leaderIds, ...partnerIds])];
  if (receiverIds.length === 0) {
    res.status(400).json({ error: '수신 가능한 팀장·타업체 계정이 없습니다.' });
    return;
  }
  const batchId = randomUUID();
  const text = content.trim();
  const created = await prisma.$transaction(
    receiverIds.map((receiverId) =>
      prisma.message.create({
        data: {
          senderId: userId,
          receiverId,
          content: text,
          batchId,
        } as any,
        include: {
          sender: { select: { id: true, name: true } },
          receiver: { select: { id: true, name: true } },
        },
      })
    )
  );
  res.status(201).json({ batchId, recipientCount: created.length });
  notifyInboxRefresh([userId, ...receiverIds]);
});

async function findEmployedUser(otherId: string) {
  const todayYmd = kstTodayYmd();
  const other = await prisma.user.findUnique({
    where: { id: otherId },
    select: { id: true, role: true, isActive: true, hireDate: true, resignationDate: true },
  });
  if (!other || !other.isActive) return null;
  if (!isUserEmployedOnYmd(other.hireDate, other.resignationDate, todayYmd)) return null;
  return other;
}

function canMessagePair(myRole: string, otherRole: string): boolean {
  const staff = myRole === 'ADMIN' || myRole === 'MARKETER';
  const otherStaff = otherRole === 'ADMIN' || otherRole === 'MARKETER';
  const fieldRole = (r: string) => r === 'TEAM_LEADER' || r === 'EXTERNAL_PARTNER';
  if (staff && fieldRole(otherRole)) return true;
  if (fieldRole(myRole) && otherStaff) return true;
  return false;
}

router.get('/:userId', async (req, res) => {
  const { userId: myId, role } = (req as unknown as { user: AuthPayload }).user;
  const { userId: otherId } = req.params;
  const other = await findEmployedUser(otherId);
  if (!other) {
    res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  if (!canMessagePair(role, other.role)) {
    res.status(403).json({ error: '대화할 수 없는 사용자입니다.' });
    return;
  }
  const messages = (await prisma.message.findMany({
    where: {
      OR: [
        { senderId: myId, receiverId: otherId },
        { senderId: otherId, receiverId: myId },
      ],
    },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      content: true,
      createdAt: true,
      readAt: true,
      senderId: true,
      receiverId: true,
      batchId: true,
      sender: { select: { id: true, name: true } },
    },
  } as any)) as Array<{
    id: string;
    content: string;
    createdAt: Date;
    readAt: Date | null;
    senderId: string;
    receiverId: string;
    batchId: string | null;
    sender: { id: string; name: string };
  }>;
  await prisma.message.updateMany({
    where: { senderId: otherId, receiverId: myId, readAt: null },
    data: { readAt: new Date() },
  });
  res.json(messages);
});

router.post('/', async (req, res) => {
  const { userId, role } = (req as unknown as { user: AuthPayload }).user;
  const { receiverId, content } = req.body as { receiverId?: string; content?: string };
  if (!receiverId || !content?.trim()) {
    res.status(400).json({ error: '수신자와 내용을 입력해주세요.' });
    return;
  }
  const receiver = await findEmployedUser(receiverId);
  if (!receiver) {
    res.status(400).json({ error: '수신자를 찾을 수 없습니다.' });
    return;
  }
  if (!canMessagePair(role, receiver.role)) {
    res.status(403).json({ error: '해당 수신자에게 메시지를 보낼 수 없습니다.' });
    return;
  }
  const msg = await prisma.message.create({
    data: {
      senderId: userId,
      receiverId,
      content: content.trim(),
    },
    include: {
      sender: { select: { id: true, name: true } },
      receiver: { select: { id: true, name: true } },
    },
  });
  res.status(201).json(msg);
  notifyInboxRefresh([userId, receiverId]);
});

export default router;
