import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { isUserEmployedOnYmd, kstTodayYmd } from '../users/userEmployment.js';

const router = Router();

router.use(authMiddleware);

type PartnerRow = { id: string; name: string; role: string };

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
  return partners.map((u) => ({
    ...u,
    lastMessage: lastByPartner.get(u.id) ?? null,
    unreadCount: unreadMap.get(u.id) ?? 0,
  }));
}

/** 관리자·마케터: 팀장 목록 / 팀장: 관리자·마케터 목록 — N+1 최소화 */
router.get('/conversations', async (req, res) => {
  const { userId, role } = (req as unknown as { user: AuthPayload }).user;
  const todayYmd = kstTodayYmd();

  if (role === 'ADMIN' || role === 'MARKETER') {
    const usersRaw = await prisma.user.findMany({
      where: { role: 'TEAM_LEADER', isActive: true },
      select: { id: true, name: true, role: true, hireDate: true, resignationDate: true },
    });
    const users = usersRaw.filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, todayYmd));
    const partners: PartnerRow[] = users.map((u) => ({ id: u.id, name: u.name, role: u.role }));
    const list = await buildConversationList(userId, partners);
    res.json(list);
    return;
  }

  if (role === 'TEAM_LEADER') {
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

/** 상대가 허용된 역할인지: 관리자↔팀장 간만 */
function canMessagePair(
  myRole: string,
  otherRole: string
): boolean {
  const staff = myRole === 'ADMIN' || myRole === 'MARKETER';
  const otherStaff = otherRole === 'ADMIN' || otherRole === 'MARKETER';
  if (staff && otherRole === 'TEAM_LEADER') return true;
  if (myRole === 'TEAM_LEADER' && otherStaff) return true;
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
  const messages = await prisma.message.findMany({
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
      sender: { select: { id: true, name: true } },
    },
  });
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
});

export default router;
