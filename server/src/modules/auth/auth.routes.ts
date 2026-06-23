import { Router, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../../lib/prisma.js';
import { config } from '../../config/index.js';
import { authMiddleware, type AuthPayload, type CrewViewerRole } from './auth.middleware.js';
import { isTenantOwnerAdmin } from './tenantOwner.js';
import { isTeamPreviewAdminEmail } from './teamPreview.helpers.js';
import { userMayUseStagingDbImport, userIsPlatformOperator } from '../admin/stagingDbImport.helpers.js';
import { isUserEmployedOnYmd, kstTodayYmd } from '../users/userEmployment.js';
import {
  assertTenantLoginAllowed,
  normalizeTenantSlugInput,
  resolveTenantBySlug,
  tenantSummary,
  TenantNotFoundError,
  TenantSuspendedError,
} from '../tenants/tenant.service.js';
import { DEFAULT_TENANT_SLUG } from '../tenants/tenant.constants.js';
import { getEffectiveEnabledModules } from '../tenants/tenantFeatures.service.js';
import { getTenantConfig } from '../tenants/tenantConfig.service.js';
import {
  findActiveTenantSupportAccess,
  ensureSupportShadowUser,
  touchTenantSupportAccessLastUsed,
} from '../platform/tenantSupportAccess.service.js';
import {
  listOperatingCompanies,
  listUserOperatingCompanies,
} from '../operating-companies/operatingCompany.service.js';
import { userHasStaffAdminAccessWithLevel } from './staffAdminAccess.service.js';

async function loginViaTenantSupportAccess(
  loginId: string,
  password: string,
  tenant: { id: string },
) {
  const support = await findActiveTenantSupportAccess(loginId);
  if (!support) return null;
  const valid = await bcrypt.compare(password, support.passwordHash);
  if (!valid) return null;
  const user = await ensureSupportShadowUser(support, tenant.id);
  if (!user.isActive) return null;
  await touchTenantSupportAccessLastUsed(support.id);
  return user;
}

/** 활성 크루 그룹 — 로그인·미리보기 공통 조회 (tenantId 있으면 해당 업체로 한정) */
async function findActiveCrewGroupByLoginId(loginId: string, tenantId?: string) {
  const lid = loginId.trim();
  if (!lid) return null;
  return prisma.teamCrewGroup.findFirst({
    where: {
      loginId: lid,
      isActive: true,
      ...(tenantId ? { tenantId } : {}),
    },
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
    tenantId: group.tenantId,
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
  const { email, password, tenantSlug } = req.body as {
    email?: string;
    password?: string;
    tenantSlug?: string;
  };
  const loginId = String(email ?? '')
    .trim()
    .toLowerCase();
  if (!loginId || !password) {
    res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
    return;
  }

  let tenant;
  try {
    tenant = await resolveTenantBySlug(normalizeTenantSlugInput(tenantSlug));
    await assertTenantLoginAllowed(tenant.status);
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    if (e instanceof TenantSuspendedError) {
      res.status(403).json({ error: e.message });
      return;
    }
    throw e;
  }

  let user = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId: tenant.id, email: loginId } },
  });

  if (!user || !user.isActive) {
    const supportUser = await loginViaTenantSupportAccess(loginId, password, tenant);
    if (supportUser) {
      user = supportUser;
    }
  }

  if (!user || !user.isActive) {
    if (tenant.slug !== DEFAULT_TENANT_SLUG) {
      const defaultTenant = await prisma.tenant.findUnique({
        where: { slug: DEFAULT_TENANT_SLUG },
        select: { id: true },
      });
      if (defaultTenant) {
        const onDefault = await prisma.user.findUnique({
          where: { tenantId_email: { tenantId: defaultTenant.id, email: loginId } },
          select: { isActive: true },
        });
        if (onDefault?.isActive) {
          res.status(401).json({
            error: `이 아이디는 업체 코드「${DEFAULT_TENANT_SLUG}」에서 로그인합니다. 업체 코드를 확인해 주세요.`,
          });
          return;
        }
      }
    }
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
    tenantId: tenant.id,
    isTenantOwner: user.role === 'ADMIN' ? user.isTenantOwner : undefined,
    isPlatformSupportAccess: user.platformSupportAccessId ? true : undefined,
  };
  const token = jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  } as jwt.SignOptions);
  const tenantConfig = await getTenantConfig(tenant.id);
  const isSupport = Boolean(user.platformSupportAccessId);
  res.json({
    token,
    user: {
      id: user.id,
      email: isSupport ? loginId : user.email,
      name: user.name,
      role: user.role,
      isPlatformSupportAccess: isSupport || undefined,
    },
    tenant: tenantSummary(tenant, tenantConfig.branding?.displayName),
  });
}

/** 관리자·마케터·팀장 공통 로그인 (역할에 따라 클라이언트에서 분기) */
router.post('/login', loginWithPassword);

/** 하위 호환: 기존 팀장 전용 URL — 동일 처리 */
router.post('/team-login', loginWithPassword);

router.get('/me', authMiddleware, async (req, res) => {
  const auth = (req as unknown as { user: AuthPayload }).user;
  const { userId, tenantId } = auth;
  const user = await prisma.user.findFirst({
    where: { id: userId, ...(tenantId ? { tenantId } : {}) },
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
      isTenantOwner: true,
      platformSupportAccessId: true,
      tenantId: true,
      marketerAdminLevel: true,
    },
  });
  if (!user) {
    res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  const supportLoginId = user.platformSupportAccessId
    ? (
        await prisma.tenantSupportAccess.findUnique({
          where: { id: user.platformSupportAccessId },
          select: { loginId: true },
        })
      )?.loginId
    : null;
  const tenant = tenantId
    ? await prisma.tenant.findUnique({
        where: { id: tenantId },
        select: { id: true, slug: true, name: true, plan: true, status: true },
      })
    : null;
  const features = tenantId ? await getEffectiveEnabledModules(tenantId) : [];
  const config = tenantId ? await getTenantConfig(tenantId) : {};
  const marketerAdminLevel = user.role === 'MARKETER' ? user.marketerAdminLevel : 'NONE';
  const effectiveStaffAdminAccess = userHasStaffAdminAccessWithLevel(auth, marketerAdminLevel);
  const marketerOperationalAdminAccess =
    user.role === 'ADMIN' ||
    (user.role === 'MARKETER' && (marketerAdminLevel === 'LIMITED' || marketerAdminLevel === 'FULL'));
  /** @deprecated per-user level — FULL만 true */
  const marketerAdminAccess = effectiveStaffAdminAccess;
  const operatingCompaniesResolved = tenantId
    ? effectiveStaffAdminAccess
      ? (await listOperatingCompanies(prisma, tenantId)).map((oc) => ({
          ...oc,
          isPrimary: oc.isDefault,
        }))
      : await listUserOperatingCompanies(prisma, tenantId, userId)
    : [];
  const r =
    user.role === 'TEAM_LEADER' || user.role === 'EXTERNAL_PARTNER' || user.role === 'MARKETER'
      ? {
          staffIdCardUrl: user.staffIdCardUrl ?? null,
          hireDate: user.hireDate,
        }
      : { staffIdCardUrl: null as string | null, hireDate: null as Date | null };
  res.json({
    ...user,
    email: supportLoginId ?? user.email,
    staffIdCardUrl: r.staffIdCardUrl,
    hireDate: r.hireDate,
    allowSelfDayOffEdit: user.role === 'TEAM_LEADER' ? user.allowSelfDayOffEdit : true,
    isSuperAdmin: isTenantOwnerAdmin({ ...auth, isTenantOwner: user.isTenantOwner }),
    isTenantOwner: user.isTenantOwner,
    isPlatformSupportAccess: Boolean(user.platformSupportAccessId),
    showStagingDbImport: userMayUseStagingDbImport(user.role, user.email),
    showVolumeStats: userIsPlatformOperator(user.role, user.email),
    marketerAdminLevel: user.role === 'MARKETER' ? user.marketerAdminLevel : 'NONE',
    marketerOperationalAdminAccess,
    hasAdminPrivileges: marketerOperationalAdminAccess,
    marketerAdminAccess,
    effectiveStaffAdminAccess,
    tenant: tenant ? tenantSummary(tenant, (config as { branding?: { displayName?: string } }).branding?.displayName) : null,
    features,
    config,
    operatingCompanies: operatingCompaniesResolved,
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
  const { loginId, password, tenantSlug } = req.body as {
    loginId?: string;
    password?: string;
    tenantSlug?: string;
  };
  const lid = loginId != null ? String(loginId).trim() : '';
  const pw = password != null ? String(password) : '';
  if (!lid || !pw) {
    res.status(400).json({ error: '아이디와 비밀번호를 입력해주세요.' });
    return;
  }
  let tenant;
  try {
    tenant = await resolveTenantBySlug(normalizeTenantSlugInput(tenantSlug));
    await assertTenantLoginAllowed(tenant.status);
  } catch (e) {
    if (e instanceof TenantNotFoundError) {
      res.status(404).json({ error: e.message });
      return;
    }
    if (e instanceof TenantSuspendedError) {
      res.status(403).json({ error: e.message });
      return;
    }
    throw e;
  }
  const group = await findActiveCrewGroupByLoginId(lid, tenant.id);
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
