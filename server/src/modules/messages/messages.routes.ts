import { Router } from 'express';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';

const router = Router();

router.use(authMiddleware);

router.get('/conversations', async (req, res) => {
  const { userId } = (req as { user: AuthPayload }).user;
  const users = await prisma.user.findMany({
    where: { id: { not: userId }, isActive: true },
    select: { id: true, name: true, role: true },
  });
  const list = await Promise.all(
    users.map(async (u) => {
      const [lastMsg, unreadCount] = await Promise.all([
        prisma.message.findFirst({
          where: {
            OR: [
              { senderId: userId, receiverId: u.id },
              { senderId: u.id, receiverId: userId },
            ],
          },
          orderBy: { createdAt: 'desc' },
          select: { content: true, createdAt: true, senderId: true },
        }),
        prisma.message.count({
          where: { receiverId: userId, senderId: u.id, readAt: null },
        }),
      ]);
      return { ...u, lastMessage: lastMsg, unreadCount };
    })
  );
  res.json(list);
});

router.get('/unread-count', async (req, res) => {
  const { userId } = (req as { user: AuthPayload }).user;
  const count = await prisma.message.count({
    where: { receiverId: userId, readAt: null },
  });
  res.json({ count });
});

router.get('/:userId', async (req, res) => {
  const { userId: myId } = (req as { user: AuthPayload }).user;
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

router.post('/', async (req, res) => {
  const { userId } = (req as { user: AuthPayload }).user;
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
