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
  const role = (req.query.role as string) || 'TEAM_LEADER';
  const validRoles = ['TEAM_LEADER', 'MARKETER'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: '유효하지 않은 역할입니다.' });
    return;
  }
  const users = await prisma.user.findMany({
    where: { role: role as 'TEAM_LEADER' | 'MARKETER', isActive: true },
    select: { id: true, email: true, name: true, phone: true, role: true },
    orderBy: { name: 'asc' },
  });
  res.json(users);
});

router.post('/', async (req, res) => {
  const { email, password, name, phone, role } = req.body as {
    email?: string;
    password?: string;
    name?: string;
    phone?: string;
    role?: 'TEAM_LEADER' | 'MARKETER';
  };
  if (!email || !password || !name) {
    res.status(400).json({ error: '아이디, 비밀번호, 이름을 입력해주세요.' });
    return;
  }
  const userRole = role === 'MARKETER' ? 'MARKETER' : 'TEAM_LEADER';
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
      role: userRole,
    },
    select: { id: true, email: true, name: true, phone: true, role: true },
  });
  res.status(201).json(user);
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body as {
    email?: string;
    name?: string;
    phone?: string | null;
    password?: string;
  };
  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, email: true },
  });
  if (!existing || (existing.role !== 'TEAM_LEADER' && existing.role !== 'MARKETER')) {
    res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  const data: {
    email?: string;
    name?: string;
    phone?: string | null;
    passwordHash?: string;
  } = {};
  if (body.name != null) {
    const name = String(body.name).trim();
    if (!name) {
      res.status(400).json({ error: '이름을 입력해주세요.' });
      return;
    }
    data.name = name;
  }
  if (body.phone !== undefined) {
    data.phone = body.phone ? String(body.phone).trim() : null;
  }
  if (body.password != null && String(body.password).trim() !== '') {
    data.passwordHash = await bcrypt.hash(String(body.password).trim(), 10);
  }
  if (body.email != null) {
    const newEmail = String(body.email).trim().toLowerCase();
    if (!newEmail) {
      res.status(400).json({ error: '아이디를 입력해주세요.' });
      return;
    }
    if (newEmail !== existing.email.toLowerCase()) {
      const taken = await prisma.user.findFirst({
        where: { email: newEmail, NOT: { id } },
      });
      if (taken) {
        res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
        return;
      }
      data.email = newEmail;
    }
  }
  if (Object.keys(data).length === 0) {
    const u = await prisma.user.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, phone: true, role: true },
    });
    res.json(u);
    return;
  }
  const updated = await prisma.user.update({
    where: { id },
    data,
    select: { id: true, email: true, name: true, phone: true, role: true },
  });
  res.json(updated);
});

router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: { role: true },
  });
  if (!user || (user.role !== 'TEAM_LEADER' && user.role !== 'MARKETER')) {
    res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  await prisma.user.update({
    where: { id },
    data: { isActive: false },
  });
  res.json({ ok: true });
});

export default router;
