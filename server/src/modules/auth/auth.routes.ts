import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';
import { config } from '../../config/index.js';
import { authMiddleware, type AuthPayload } from './auth.middleware.js';
import { isSuperAdminRoleAndEmail } from './superAdmin.js';
import { isUserEmployedOnYmd, kstTodayYmd } from '../users/userEmployment.js';

const router = Router();

async function loginWithPassword(req: Request, res: Response) {
  const { email, password } = req.body as { email?: string; password?: string };
  const loginId = String(email ?? '')
    .trim()
    .toLowerCase();
  if (!loginId || !password) {
    res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
    return;
  }
  const user = await prisma.user.findUnique({
    where: { email: loginId },
  });
  if (!user || !user.isActive) {
    res.status(401).json({ error: '계정을 찾을 수 없거나 비활성입니다.' });
    return;
  }
  if (
    (user.role === 'TEAM_LEADER' ||
      user.role === 'MARKETER' ||
      user.role === 'EXTERNAL_PARTNER') &&
    !isUserEmployedOnYmd(user.hireDate, user.resignationDate, kstTodayYmd())
  ) {
    res.status(401).json({ error: '입사·퇴사 기간에 해당하지 않는 계정입니다.' });
    return;
  }
  if (
    user.role !== 'ADMIN' &&
    user.role !== 'MARKETER' &&
    user.role !== 'TEAM_LEADER' &&
    user.role !== 'EXTERNAL_PARTNER'
  ) {
    res.status(401).json({ error: '로그인할 수 없는 계정입니다.' });
    return;
  }
  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    return;
  }
  const payload: AuthPayload = {
    userId: user.id,
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
}

/** 관리자·마케터·팀장 공통 로그인 (역할에 따라 클라이언트에서 분기) */
router.post('/login', loginWithPassword);

/** 하위 호환: 기존 팀장 전용 URL — 동일 처리 */
router.post('/team-login', loginWithPassword);

router.get('/me', authMiddleware, async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      vehicleNumber: true,
      role: true,
      allowSelfDayOffEdit: true,
    },
  });
  if (!user) {
    res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  res.json({
    ...user,
    allowSelfDayOffEdit: user.role === 'TEAM_LEADER' ? user.allowSelfDayOffEdit : true,
    isSuperAdmin: isSuperAdminRoleAndEmail(user.role, user.email),
  });
});

router.patch('/me', authMiddleware, async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const body = req.body as { name?: string; phone?: string | null; vehicleNumber?: string | null; password?: string };
  const data: { name?: string; phone?: string | null; vehicleNumber?: string | null; passwordHash?: string } = {};

  if (body.name !== undefined) {
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
  if (body.vehicleNumber !== undefined) {
    data.vehicleNumber = body.vehicleNumber ? String(body.vehicleNumber).trim() : null;
  }
  if (body.password !== undefined) {
    const password = String(body.password).trim();
    if (password.length > 0) {
      data.passwordHash = await bcrypt.hash(password, 10);
    }
  }

  if (Object.keys(data).length === 0) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        vehicleNumber: true,
        role: true,
        allowSelfDayOffEdit: true,
      },
    });
    if (!user) {
      res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
      return;
    }
    res.json({
      ...user,
      allowSelfDayOffEdit: user.role === 'TEAM_LEADER' ? user.allowSelfDayOffEdit : true,
    });
    return;
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      vehicleNumber: true,
      role: true,
      allowSelfDayOffEdit: true,
    },
  });
  res.json({
    ...updated,
    allowSelfDayOffEdit: updated.role === 'TEAM_LEADER' ? updated.allowSelfDayOffEdit : true,
  });
});

export default router;
