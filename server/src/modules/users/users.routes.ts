import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOnly } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';

const router = Router();

router.use(authMiddleware);
router.use(adminOnly);

router.get('/', async (req, res) => {
  const teamLeaders = await prisma.user.findMany({
    where: { role: 'TEAM_LEADER', isActive: true },
    select: { id: true, email: true, name: true, phone: true },
    orderBy: { name: 'asc' },
  });
  res.json(teamLeaders);
});

router.post('/', async (req, res) => {
  const { email, password, name, phone } = req.body as {
    email?: string;
    password?: string;
    name?: string;
    phone?: string;
  };
  if (!email || !password || !name) {
    res.status(400).json({ error: '아이디, 비밀번호, 이름을 입력해주세요.' });
    return;
  }
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
    return;
  }
  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      phone: phone || null,
      role: 'TEAM_LEADER',
    },
    select: { id: true, email: true, name: true, phone: true },
  });
  res.status(201).json(user);
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });
  if (!user || user.role !== 'TEAM_LEADER') {
    res.status(404).json({ error: '팀장을 찾을 수 없습니다.' });
    return;
  }
  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });
  res.json({ ok: true });
});

export default router;
