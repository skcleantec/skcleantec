import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';
import { config } from '../../config/index.js';
import { authMiddleware, type AuthPayload, type CrewViewerRole } from './auth.middleware.js';
import { isSuperAdminRoleAndEmail } from './superAdmin.js';
import { isTeamPreviewAdminEmail } from './teamPreview.helpers.js';
import { isUserEmployedOnYmd, kstTodayYmd } from '../users/userEmployment.js';

/** 활성 크루 그룹 — 로그인·미리보기 공통 조회 */
async function findActiveCrewGroupByLoginId(loginId: string) {
  const lid = loginId.trim();
  if (!lid) return null;
  return prisma.teamCrewGroup.findFirst({
    where: { loginId: lid, isActive: true },
    include: {
      members: { select: { isGroupLeader: true } },
    },
  });
}

function issueCrewJwtPayload(
  group: NonNullable<Awaited<ReturnType<typeof findActiveCrewGroupByLoginId>>>,
  crewJwtSource: 'login' | 'preview',
) {
  const hasLeaderSlot = group.members.some((m) => m.isGroupLeader);
  const crewViewerRole: CrewViewerRole = hasLeaderSlot ? 'LEADER' : 'MEMBER';
  const payload: AuthPayload = {
    userId: `crew:${group.id}`,
    email: group.loginId,
    role: 'TEAM_CREW_GROUP',
    crewGroupId: group.id,
    crewViewerRole,
    crewJwtSource,
  };
  const token = jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
  return { token, crewViewerRole };
}

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
      nameEn: true,
      phone: true,
      vehicleNumber: true,
      role: true,
      allowSelfDayOffEdit: true,
      staffIdCardUrl: true,
      hireDate: true,
    },
  });
  if (!user) {
    res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  const r =
    user.role === 'TEAM_LEADER' || user.role === 'EXTERNAL_PARTNER' || user.role === 'MARKETER'
      ? {
          staffIdCardUrl: user.staffIdCardUrl ?? null,
          hireDate: user.hireDate,
        }
      : { staffIdCardUrl: null as string | null, hireDate: null as Date | null };
  res.json({
    ...user,
    staffIdCardUrl: r.staffIdCardUrl,
    hireDate: r.hireDate,
    allowSelfDayOffEdit: user.role === 'TEAM_LEADER' ? user.allowSelfDayOffEdit : true,
    isSuperAdmin: isSuperAdminRoleAndEmail(user.role, user.email),
  });
});

router.patch('/me', authMiddleware, async (req, res) => {
  const { userId } = (req as unknown as { user: AuthPayload }).user;
  const body = req.body as {
    name?: string;
    phone?: string | null;
    vehicleNumber?: string | null;
    password?: string;
    nameEn?: string | null;
  };
  const data: {
    name?: string;
    phone?: string | null;
    vehicleNumber?: string | null;
    passwordHash?: string;
    nameEn?: string | null;
  } = {};

  if (body.vehicleNumber !== undefined) {
    const existingForVehicle = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true, email: true },
    });
    const canSetVehicle =
      existingForVehicle?.role === 'TEAM_LEADER' ||
      existingForVehicle?.role === 'EXTERNAL_PARTNER' ||
      (existingForVehicle?.role === 'ADMIN' && isTeamPreviewAdminEmail(existingForVehicle.email));
    if (canSetVehicle) {
      const v = body.vehicleNumber ? String(body.vehicleNumber).trim() : '';
      if (v.length > 64) {
        res.status(400).json({ error: '차량번호는 64자 이내로 입력해 주세요.' });
        return;
      }
      data.vehicleNumber = v || null;
    }
    /** 그 외 관리자·마케터는 vehicleNumber 키가 와도 무시 */
  }

  if (body.nameEn !== undefined) {
    const existingForEn = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true },
    });
    if (existingForEn?.role === 'TEAM_LEADER') {
      const v = body.nameEn ? String(body.nameEn).trim() : '';
      if (v.length > 128) {
        res.status(400).json({ error: '영문 이름은 128자 이내로 입력해 주세요.' });
        return;
      }
      data.nameEn = v || null;
    }
  }

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
        nameEn: true,
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
      nameEn: true,
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

/** 크루 공유 계정 (TeamCrewGroup.loginId / passwordHash) */
router.post('/crew-login', async (req, res) => {
  const { loginId, password } = req.body as { loginId?: string; password?: string };
  const lid = loginId != null ? String(loginId).trim() : '';
  const pw = password != null ? String(password) : '';
  if (!lid || !pw) {
    res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
    return;
  }
  const group = await findActiveCrewGroupByLoginId(lid);
  if (!group) {
    res.status(401).json({ error: '계정을 찾을 수 없거나 비활성입니다.' });
    return;
  }
  const valid = await bcrypt.compare(pw, group.passwordHash);
  if (!valid) {
    res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    return;
  }
  const { token, crewViewerRole } = issueCrewJwtPayload(group, 'login');
  res.json({
    token,
    crewGroup: {
      id: group.id,
      name: group.name,
      crewViewerRole,
      crewJwtSource: 'login' as const,
    },
  });
});

/**
 * 관리자 미리보기 전용 — 비밀번호 없이 크루 JWT 발급
 * (역할 ADMIN 또는 MARKETER, 관리자 GNB 「미리보기」패널과 동일 조건)
 */
router.post('/crew-dev-preview', authMiddleware, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (user.role !== 'ADMIN' && user.role !== 'MARKETER') {
    res.status(403).json({ error: '권한이 필요합니다.' });
    return;
  }
  const { loginId } = req.body as { loginId?: string };
  const lid = loginId != null ? String(loginId).trim() : '';
  if (!lid) {
    res.status(400).json({ error: '크루 로그인 아이디를 입력해주세요.' });
    return;
  }
  const group = await findActiveCrewGroupByLoginId(lid);
  if (!group) {
    res.status(404).json({ error: '계정을 찾을 수 없거나 비활성입니다.' });
    return;
  }
  const { token, crewViewerRole } = issueCrewJwtPayload(group, 'preview');
  res.json({
    token,
    crewGroup: {
      id: group.id,
      name: group.name,
      crewViewerRole,
      crewJwtSource: 'preview' as const,
    },
  });
});

/** 크루 세션 프로필 — `/auth/me`와 분리 (User 테이블 없음) */
router.get('/crew-me', authMiddleware, async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  if (user.role !== 'TEAM_CREW_GROUP' || !user.crewGroupId) {
    res.status(403).json({ error: '크루 그룹 세션이 아닙니다.' });
    return;
  }
  const group = await prisma.teamCrewGroup.findUnique({
    where: { id: user.crewGroupId },
    include: {
      members: {
        include: {
          teamMember: { select: { id: true, name: true, nameTh: true, phone: true, isActive: true } },
        },
        orderBy: { createdAt: 'asc' },
      },
    },
  });
  if (!group || !group.isActive) {
    res.status(404).json({ error: '그룹을 찾을 수 없습니다.' });
    return;
  }
  const hasLeaderSlot = group.members.some((m) => m.isGroupLeader);
  const crewViewerRole: CrewViewerRole = hasLeaderSlot ? 'LEADER' : 'MEMBER';

  const crewJwtSource = user.crewJwtSource ?? 'login';

  res.json({
    role: 'TEAM_CREW_GROUP',
    crewGroupId: group.id,
    crewViewerRole,
    crewJwtSource,
    group: {
      id: group.id,
      name: group.name,
      loginId: group.loginId,
      phone: group.phone,
      useDailyRosterOnly: group.useDailyRosterOnly,
      hasSettingsPassword: group.settingsPasswordHash != null,
      members: group.members.map((m) => ({
        teamMemberId: m.teamMemberId,
        name: m.teamMember.name,
        nameTh: m.teamMember.nameTh,
        phone: m.teamMember.phone,
        isActive: m.teamMember.isActive,
        isGroupLeader: m.isGroupLeader,
      })),
    },
  });
});

export default router;
