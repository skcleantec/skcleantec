import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { isUserEmployedOnYmd, kstTodayYmd } from '../users/userEmployment.js';
import { notifyInboxRefresh } from '../realtime/inboxNotify.js';
import { notifyCrewGroupsInboxRefresh } from '../crew/crewFieldRealtime.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';

const router = Router();

router.use(authMiddleware);

type PartnerRow = { id: string; name: string; role: string; staffIdCardUrl: string | null };

const messageSenderSelect = { id: true, name: true, staffIdCardUrl: true } as const;

type MessageSenderDto = { id: string; name: string; staffIdCardUrl: string | null };

/** ADMIN·MARKETER 팀 화면 미리보기 시 previewRole 쿼리로 실제 행위자(팀장·타업체)로 치환 — teamAuthMiddleware와 동일 */
async function resolveTeamPreviewActor(
  req: { query: Record<string, unknown> },
  user: AuthPayload
): Promise<AuthPayload> {
  const isStaff = user.role === 'ADMIN' || user.role === 'MARKETER';
  if (!isStaff) return user;

  const tenantId = user.tenantId ?? null;
  if (!tenantId) return user;

  if (req.query.previewRole === 'team_leader') {
    const tlId =
      typeof req.query.previewTeamLeaderId === 'string' ? req.query.previewTeamLeaderId.trim() : '';
    if (tlId) {
      const target = await prisma.user.findFirst({
        where: { id: tlId, tenantId, role: 'TEAM_LEADER', isActive: true },
        select: { id: true, email: true },
      });
      if (target) {
        return { userId: target.id, email: target.email, role: 'TEAM_LEADER', tenantId };
      }
    }
    return user;
  }

  const previewExternal = req.query.previewRole === 'external';
  if (!previewExternal) return user;
  const externalCompanyId =
    typeof req.query.externalCompanyId === 'string' ? req.query.externalCompanyId.trim() : '';
  const externalNameRaw =
    typeof req.query.previewExternalName === 'string' ? req.query.previewExternalName.trim() : '';
  const externalName = externalNameRaw || '클린느';
  const extUser = await prisma.user.findFirst({
    where: {
      role: 'EXTERNAL_PARTNER',
      isActive: true,
      ...(tenantId ? { tenantId } : {}),
      ...(externalCompanyId
        ? { externalCompanyId }
        : { externalCompany: { is: { name: externalName, ...(tenantId ? { tenantId } : {}) } } }),
    },
    orderBy: { createdAt: 'asc' },
    select: { id: true, email: true },
  });
  if (!extUser) {
    return user;
  }
  return { userId: extUser.id, email: extUser.email, role: 'EXTERNAL_PARTNER' };
}

async function getEmployedStaffIds(tenantId: string): Promise<string[]> {
  const todayYmd = kstTodayYmd();
  const usersRaw = await prisma.user.findMany({
    where: { tenantId, isActive: true, role: { in: ['ADMIN', 'MARKETER'] } },
    select: { id: true, hireDate: true, resignationDate: true },
  });
  return usersRaw.filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, todayYmd)).map((u) => u.id);
}

async function getEmployedTeamLeaderIds(tenantId: string): Promise<string[]> {
  const todayYmd = kstTodayYmd();
  const usersRaw = await prisma.user.findMany({
    where: { tenantId, role: 'TEAM_LEADER', isActive: true },
    select: { id: true, hireDate: true, resignationDate: true },
  });
  return usersRaw.filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, todayYmd)).map((u) => u.id);
}

async function getEmployedExternalPartnerIds(tenantId: string): Promise<string[]> {
  const todayYmd = kstTodayYmd();
  const usersRaw = await prisma.user.findMany({
    where: { tenantId, role: 'EXTERNAL_PARTNER', isActive: true },
    select: { id: true, hireDate: true, resignationDate: true },
  });
  return usersRaw.filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, todayYmd)).map((u) => u.id);
}

async function getActiveCrewGroupIds(tenantId: string): Promise<string[]> {
  const rows = await prisma.teamCrewGroup.findMany({
    where: { tenantId, isActive: true },
    select: { id: true },
  });
  return rows.map((r) => r.id);
}

async function buildConversationList(
  tenantId: string,
  myUserId: string,
  partners: PartnerRow[],
  opts?: { staffIdsMerge?: string[] },
) {
  if (partners.length === 0) return [];
  const partnerIds = partners.map((p) => p.id);
  const partnerIdSet = new Set(partnerIds);
  const staffMergeSet = new Set((opts?.staffIdsMerge ?? []).filter(Boolean));
  const useMerge = staffMergeSet.size > 0;

  const messageWhere = useMerge
    ? {
        tenantId,
        OR: [
          { senderId: myUserId, receiverId: { in: partnerIds } },
          { senderId: { in: partnerIds }, receiverId: myUserId },
          { senderId: { in: [...staffMergeSet] }, receiverId: { in: partnerIds } },
          { senderId: { in: partnerIds }, receiverId: { in: [...staffMergeSet] } },
        ],
      }
    : {
        tenantId,
        OR: [
          { senderId: myUserId, receiverId: { in: partnerIds } },
          { senderId: { in: partnerIds }, receiverId: myUserId },
        ],
      };

  const [allMessages, unreadBySender] = await Promise.all([
    prisma.message.findMany({
      where: messageWhere,
      orderBy: { createdAt: 'desc' },
      take: 1000,
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
    let partnerId: string | null = null;
    if (useMerge) {
      if (partnerIdSet.has(m.senderId) && (m.receiverId === myUserId || staffMergeSet.has(m.receiverId))) {
        partnerId = m.senderId;
      } else if (partnerIdSet.has(m.receiverId) && (m.senderId === myUserId || staffMergeSet.has(m.senderId))) {
        partnerId = m.receiverId;
      }
    } else if (m.senderId === myUserId && partnerIdSet.has(m.receiverId)) {
      partnerId = m.receiverId;
    } else if (m.receiverId === myUserId && partnerIdSet.has(m.senderId)) {
      partnerId = m.senderId;
    }
    if (partnerId && !lastByPartner.has(partnerId)) lastByPartner.set(partnerId, m);
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
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { userId, role } = user;
  const todayYmd = kstTodayYmd();

  if (role === 'ADMIN' || role === 'MARKETER') {
    const [usersRaw, staffIdsMerge] = await Promise.all([
      prisma.user.findMany({
        where: { tenantId, role: { in: ['TEAM_LEADER', 'EXTERNAL_PARTNER'] }, isActive: true },
        select: {
          id: true,
          name: true,
          role: true,
          staffIdCardUrl: true,
          hireDate: true,
          resignationDate: true,
          externalCompany: { select: { name: true } },
        },
      }),
      getEmployedStaffIds(tenantId),
    ]);
    const users = usersRaw.filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, todayYmd));
    const partners: PartnerRow[] = users.map((u) => ({
      id: u.id,
      name: u.role === 'EXTERNAL_PARTNER' && u.externalCompany?.name ? `${u.name} (${u.externalCompany.name})` : u.name,
      role: u.role,
      staffIdCardUrl: u.staffIdCardUrl ?? null,
    }));
    const list = await buildConversationList(tenantId, userId, partners, { staffIdsMerge });
    res.json(list);
    return;
  }

  if (role === 'TEAM_LEADER' || role === 'EXTERNAL_PARTNER') {
    const usersRaw = await prisma.user.findMany({
      where: {
        tenantId,
        isActive: true,
        role: { in: ['ADMIN', 'MARKETER'] },
      },
      select: { id: true, name: true, role: true, staffIdCardUrl: true, hireDate: true, resignationDate: true },
    });
    const users = usersRaw.filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, todayYmd));
    const partners: PartnerRow[] = users.map((u) => ({
      id: u.id,
      name: u.name,
      role: u.role,
      staffIdCardUrl: u.staffIdCardUrl ?? null,
    }));
    const list = await buildConversationList(tenantId, userId, partners);
    res.json(list);
    return;
  }

  res.status(403).json({ error: '메시지를 사용할 수 없습니다.' });
});

router.get('/unread-count', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { userId } = user;
  const count = await prisma.message.count({
    where: { tenantId, receiverId: userId, readAt: null },
  });
  res.json({ count });
});

/** 팀장: 운영(관리자·마케터)과의 통합 대화 (선택 없이 한 화면) */
router.get('/team-office', async (req, res) => {
  const rawUser = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(rawUser);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { userId: myId, role } = await resolveTeamPreviewActor(req as any, rawUser);
  if (role !== 'TEAM_LEADER' && role !== 'EXTERNAL_PARTNER') {
    res.status(403).json({ error: '팀장·타업체만 사용할 수 있습니다.' });
    return;
  }
  const staffIds = await getEmployedStaffIds(tenantId);
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
    sender: MessageSenderDto;
  };
  const raw = (await prisma.message.findMany({
    where: {
      tenantId,
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
      sender: { select: messageSenderSelect },
    },
  })) as unknown as TeamOfficeRow[];
  const readNow = new Date();
  await prisma.message.updateMany({
    where: { tenantId, senderId: { in: staffIds }, receiverId: myId, readAt: null },
    data: { readAt: readNow },
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
  /** 응답 readAt을 DB와 동일하게(방금 읽음 처리된 행 반영) — 클라이언트가 즉시 미읽음 표시를 끌 수 있음 */
  const out = collapsed.map((m) =>
    staffIds.includes(m.senderId) && m.receiverId === myId && m.readAt == null
      ? { ...m, readAt: readNow }
      : m
  );
  res.json(out);
});

/** 팀장: 운영 전체(재직 관리자·마케터)에게 동일 내용 전송 — batchId로 묶음 */
router.post('/team-send', async (req, res) => {
  const rawUser = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(rawUser);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { userId, role } = await resolveTeamPreviewActor(req as any, rawUser);
  if (role !== 'TEAM_LEADER' && role !== 'EXTERNAL_PARTNER') {
    res.status(403).json({ error: '팀장·타업체만 전송할 수 있습니다.' });
    return;
  }
  const { content } = req.body as { content?: string };
  if (!content?.trim()) {
    res.status(400).json({ error: '내용을 입력해주세요.' });
    return;
  }
  const staffIds = await getEmployedStaffIds(tenantId);
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
          tenantId,
          senderId: userId,
          receiverId,
          content: text,
          batchId,
        },
        include: {
          sender: { select: messageSenderSelect },
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
        sender: MessageSenderDto;
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

/** 관리자·마케터: 현장 계정·크루 그룹 대상 공지(동일 내용) — 수신 대상은 본문 플래그로 선택 */
router.post('/broadcast-to-leaders', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { userId, role } = user;
  if (role !== 'ADMIN' && role !== 'MARKETER') {
    res.status(403).json({ error: '관리자·마케터만 전송할 수 있습니다.' });
    return;
  }
  const body = req.body as {
    content?: string;
    toTeamLeaders?: boolean;
    toExternalPartners?: boolean;
    toCrew?: boolean;
  };
  if (!body.content?.trim()) {
    res.status(400).json({ error: '내용을 입력해주세요.' });
    return;
  }
  const toTeamLeaders = body.toTeamLeaders === true;
  const toExternalPartners = body.toExternalPartners === true;
  const toCrew = body.toCrew === true;
  if (!toTeamLeaders && !toExternalPartners && !toCrew) {
    res.status(400).json({ error: '팀장·외부업체·팀원(크루) 중 최소 한 곳을 선택해 주세요.' });
    return;
  }

  const receiverIds: string[] = [];
  if (toTeamLeaders) receiverIds.push(...(await getEmployedTeamLeaderIds(tenantId)));
  if (toExternalPartners) receiverIds.push(...(await getEmployedExternalPartnerIds(tenantId)));
  const uniqueReceivers = [...new Set(receiverIds)];

  const crewGroupIds = toCrew ? await getActiveCrewGroupIds(tenantId) : [];

  if (uniqueReceivers.length === 0 && crewGroupIds.length === 0) {
    res.status(400).json({ error: '선택한 대상에 보낼 수 있는 계정·크루 그룹이 없습니다.' });
    return;
  }

  const batchId = randomUUID();
  const text = body.content.trim();

  await prisma.$transaction(async (tx) => {
    for (const receiverId of uniqueReceivers) {
      await tx.message.create({
        data: {
          tenantId,
          senderId: userId,
          receiverId,
          content: text,
          batchId,
        },
      });
    }
    if (crewGroupIds.length > 0) {
      await tx.crewStaffNotice.createMany({
        data: crewGroupIds.map((crewGroupId) => ({
          batchId,
          senderId: userId,
          crewGroupId,
          content: text,
        })),
      });
    }
  });

  const notifyUserIds = [userId, ...uniqueReceivers];
  notifyInboxRefresh(notifyUserIds);
  if (crewGroupIds.length > 0) {
    notifyCrewGroupsInboxRefresh(crewGroupIds);
  }

  res.status(201).json({
    batchId,
    recipientCount: uniqueReceivers.length,
    crewNoticeCount: crewGroupIds.length,
  });
});

async function findEmployedUser(otherId: string, tenantId: string) {
  const todayYmd = kstTodayYmd();
  const other = await prisma.user.findFirst({
    where: { id: otherId, tenantId },
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

function isFieldUserRole(role: string): boolean {
  return role === 'TEAM_LEADER' || role === 'EXTERNAL_PARTNER';
}

router.get('/:userId', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { userId: myId, role } = user;
  const { userId: otherId } = req.params;
  const other = await findEmployedUser(otherId, tenantId);
  if (!other) {
    res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  if (!canMessagePair(role, other.role)) {
    res.status(403).json({ error: '대화할 수 없는 사용자입니다.' });
    return;
  }

  const staff = role === 'ADMIN' || role === 'MARKETER';
  const useMergedStaffThread = staff && isFieldUserRole(other.role);
  const staffIds = useMergedStaffThread ? await getEmployedStaffIds(tenantId) : [];

  type MsgRow = {
    id: string;
    content: string;
    createdAt: Date;
    readAt: Date | null;
    senderId: string;
    receiverId: string;
    batchId: string | null;
    sender: MessageSenderDto;
  };

  let messages: MsgRow[];
  if (useMergedStaffThread && staffIds.length > 0) {
    const sidSet = new Set(staffIds);
    const raw = (await prisma.message.findMany({
      where: {
        tenantId,
        OR: [
          { senderId: myId, receiverId: otherId },
          { senderId: otherId, receiverId: myId },
          { senderId: { in: staffIds }, receiverId: otherId },
          { senderId: otherId, receiverId: { in: staffIds } },
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
        sender: { select: messageSenderSelect },
      },
    })) as unknown as MsgRow[];
    const seenBatch = new Set<string>();
    messages = [];
    for (const m of raw) {
      if (m.senderId === otherId && m.batchId && sidSet.has(m.receiverId)) {
        if (seenBatch.has(m.batchId)) continue;
        seenBatch.add(m.batchId);
      }
      messages.push(m);
    }
  } else {
    messages = (await prisma.message.findMany({
      where: {
        tenantId,
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
        sender: { select: messageSenderSelect },
      },
    })) as unknown as MsgRow[];
  }

  const readNow = new Date();
  await prisma.message.updateMany({
    where: { tenantId, senderId: otherId, receiverId: myId, readAt: null },
    data: { readAt: readNow },
  });
  const messagesOut = messages.map((m) =>
    m.senderId === otherId && m.receiverId === myId && m.readAt == null ? { ...m, readAt: readNow } : m
  );
  res.json(messagesOut);
});

router.post('/', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { userId, role } = user;
  const { receiverId, content } = req.body as { receiverId?: string; content?: string };
  if (!receiverId || !content?.trim()) {
    res.status(400).json({ error: '수신자와 내용을 입력해주세요.' });
    return;
  }
  const receiver = await findEmployedUser(receiverId, tenantId);
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
      tenantId,
      senderId: userId,
      receiverId,
      content: content.trim(),
    },
    include: {
      sender: { select: messageSenderSelect },
      receiver: { select: { id: true, name: true } },
    },
  });
  res.status(201).json(msg);
  notifyInboxRefresh([userId, receiverId]);
});

export default router;
