import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';
import { config } from '../../config/index.js';
import type { PlatformAuthPayload } from './platformAuth.types.js';
import { platformAuthMiddleware, type PlatformScopedRequest } from './platformAuth.middleware.js';

const router = Router();

router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const loginId = String(email ?? '').trim().toLowerCase();
  if (!loginId || !password) {
    res.status(400).json({ error: '이메일과 비밀번호를 입력해주세요.' });
    return;
  }

  const user = await prisma.platformUser.findUnique({ where: { email: loginId } });
  if (!user || !user.isActive) {
    res.status(401).json({ error: '계정을 찾을 수 없거나 비활성입니다.' });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    return;
  }

  const payload: PlatformAuthPayload = {
    kind: 'platform',
    platformUserId: user.id,
    email: user.email,
    role: user.role,
  };
  const token = jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);

  res.json({
    token,
    user: { id: user.id, email: user.email, name: user.name, role: user.role },
  });
});

router.get('/me', platformAuthMiddleware, async (req, res) => {
  const { platformUserId } = (req as PlatformScopedRequest).platformUser;
  const user = await prisma.platformUser.findUnique({
    where: { id: platformUserId },
    select: { id: true, email: true, name: true, role: true, isActive: true },
  });
  if (!user || !user.isActive) {
    res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  res.json(user);
});

export default router;
