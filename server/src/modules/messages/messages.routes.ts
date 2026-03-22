import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOnly } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

/** 대화 목록: 팀장만 (관리자가 팀장과 대화), N+1 최소화 */
router.get('/conversations', adminOnly, async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const users = await prisma.user.findMany({
    where: { role: 'TEAM_LEADER', isActive: true },
    select: { id: true, name: true, role: true },
  });
  if (users.length === 0) {
    res.json([]);
    return;
  }
  const userIds = users.map((u) => u.id);
  const [allMessages, unreadBySender] = await Promise.all([
    prisma.message.findMany({
      where: {
        OR: [
          { senderId: userId, receiverId: { in: userIds } },
          { senderId: { in: userIds }, receiverId: userId },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: { content: true, createdAt: true, senderId: true, receiverId: true },
    }),
    prisma.message.groupBy({
      by: ['senderId'],
      where: { receiverId: userId, senderId: { in: userIds }, readAt: null },
      _count: { id: true },
    }),
  ]);
  const unreadMap = new Map(unreadBySender.map((u) => [u.senderId, u._count.id]));
  const lastByPartner = new Map<string, { content: string; createdAt: Date; senderId: string }>();
  for (const m of allMessages) {
    const partnerId = m.senderId === userId ? m.receiverId : m.senderId;
    if (!lastByPartner.has(partnerId)) lastByPartner.set(partnerId, m);
  }
  const list = users.map((u) => ({
    ...u,
    lastMessage: lastByPartner.get(u.id) ?? null,
    unreadCount: unreadMap.get(u.id) ?? 0,
  }));
  res.json(list);
});

router.get('/unread-count', async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const count = await prisma.message.count({
    where: { receiverId: userId, readAt: null },
  });
  res.json({ count });
});

router.get('/:userId', adminOnly, async (req, res) => {
  const { userId: myId } = (req as unknown as { user: AuthPayload }).user;
  const { userId: otherId } = req.params;
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

router.post('/', adminOnly, async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const { receiverId, content } = req.body as { receiverId?: string; content?: string };
  if (!receiverId || !content?.trim()) {
    res.status(400).json({ error: '수신자와 내용을 입력해주세요.' });
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
