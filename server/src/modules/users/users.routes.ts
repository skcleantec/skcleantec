import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOnly, adminOrMarketer } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { isSuperAdminRoleAndEmail } from '../auth/superAdmin.js';
import {
  dateToYmdKst,
  isUserEmployedOnYmd,
  kstTodayYmd,
  parseYmdToUtcDate,
  serializeUserDates,
} from './userEmployment.js';

const router = Router();

const YMD = /^\d{4}-\d{2}-\d{2}$/;

router.use(authMiddleware);

/** 목록 조회 — 스케줄·접수에서 팀장/마케터 선택용 (기본: 해당일 재직자만) · scope=management 는 전체(관리자) */
router.get('/', adminOrMarketer, async (req, res) => {
  const authUser = (req as unknown as { user: AuthPayload }).user;
  const role = (req.query.role as string) || 'TEAM_LEADER';
  const validRoles = ['TEAM_LEADER', 'MARKETER'];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: '유효하지 않은 역할입니다.' });
    return;
  }
  const scope = typeof req.query.scope === 'string' ? req.query.scope : '';
  const management = scope === 'management';
  if (management && authUser.role !== 'ADMIN') {
    res.status(403).json({ error: '전체 목록은 관리자만 조회할 수 있습니다.' });
    return;
  }
  const employedOnRaw = typeof req.query.employedOn === 'string' ? req.query.employedOn.trim() : '';
  const employedOn = YMD.test(employedOnRaw) ? employedOnRaw : kstTodayYmd();

  const users = await prisma.user.findMany({
    where: { role: role as 'TEAM_LEADER' | 'MARKETER', isActive: true },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      hireDate: true,
      resignationDate: true,
    },
    orderBy: { name: 'asc' },
  });

  let out = users;
  if (!management) {
    out = users.filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, employedOn));
  }

  res.json(
    out.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      ...serializeUserDates(u),
    }))
  );
});

router.post('/', adminOnly, async (req, res) => {
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
    select: { id: true, email: true, name: true, phone: true, role: true, hireDate: true, resignationDate: true },
  });
  res.status(201).json({
    ...user,
    ...serializeUserDates(user),
  });
});

router.patch('/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const body = req.body as {
    email?: string;
    name?: string;
    phone?: string | null;
    password?: string;
    hireDate?: string | null;
    resignationDate?: string | null;
  };
  const authUser = (req as unknown as { user: AuthPayload }).user;

  const wantsEmploymentDates =
    body.hireDate !== undefined || body.resignationDate !== undefined;
  if (wantsEmploymentDates && !isSuperAdminRoleAndEmail(authUser.role, authUser.email)) {
    res.status(403).json({ error: '입사일·퇴사일은 최고 관리자만 변경할 수 있습니다.' });
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true, email: true, hireDate: true, resignationDate: true },
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
    hireDate?: Date | null;
    resignationDate?: Date | null;
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

  if (wantsEmploymentDates) {
    let hire: Date | null = existing.hireDate;
    let resign: Date | null = existing.resignationDate;
    if (body.hireDate !== undefined) {
      if (body.hireDate === null || String(body.hireDate).trim() === '') {
        hire = null;
      } else {
        const d = parseYmdToUtcDate(String(body.hireDate).trim());
        if (!d) {
          res.status(400).json({ error: '입사일은 YYYY-MM-DD 형식이어야 합니다.' });
          return;
        }
        hire = d;
      }
    }
    if (body.resignationDate !== undefined) {
      if (body.resignationDate === null || String(body.resignationDate).trim() === '') {
        resign = null;
      } else {
        const d = parseYmdToUtcDate(String(body.resignationDate).trim());
        if (!d) {
          res.status(400).json({ error: '퇴사일은 YYYY-MM-DD 형식이어야 합니다.' });
          return;
        }
        resign = d;
      }
    }
    if (hire && resign) {
      const hy = dateToYmdKst(hire);
      const ry = dateToYmdKst(resign);
      if (hy >= ry) {
        res.status(400).json({ error: '퇴사일은 입사일보다 늦어야 합니다.' });
        return;
      }
    }
    data.hireDate = hire;
    data.resignationDate = resign;
  }

  if (Object.keys(data).length === 0) {
    const u = await prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        hireDate: true,
        resignationDate: true,
      },
    });
    res.json({ ...u!, ...serializeUserDates(u!) });
    return;
  }

  const updated = await prisma.user.update({
    where: { id },
    data,
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      hireDate: true,
      resignationDate: true,
    },
  });
  res.json({ ...updated, ...serializeUserDates(updated) });
});

router.delete('/:id', adminOnly, async (req, res) => {
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
