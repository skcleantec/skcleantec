import { Router } from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import type { TeamLeaderGeneralSettlementMode, MarketerAdminLevel } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware } from '../auth/auth.middleware.js';
import { adminOnly, adminOrMarketer } from '../auth/auth.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { isTenantOwnerAdmin } from '../auth/tenantOwner.js';
import { isTeamPreviewAdminEmail } from '../auth/teamPreview.helpers.js';
import { assertValidTenantLoginId } from '../auth/tenantLoginId.js';
import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import {
  clearStaffIdCardForUser,
  replaceStaffIdCardForUser,
} from '../staff-id-card/staffIdCard.service.js';
import {
  dateToYmdKst,
  filterByEmploymentStatus,
  isUserEmployedOnYmd,
  kstTodayYmd,
  parseYmdToUtcDate,
  serializeUserDates,
  type EmploymentStatusFilter,
} from './userEmployment.js';
import {
  filterTeamLeaderIdsInServiceZone,
  listServiceZonesByUserIds,
  replaceUserServiceZones,
} from '../service-zones/userServiceZone.service.js';
import { ServiceZoneValidationError } from '../service-zones/serviceZone.service.js';
import {
  ensureDefaultMembershipForUser,
  listOperatingCompaniesByUserIds,
  parseUserOperatingCompanyMembershipInput,
  syncUserOperatingCompanies,
  userRoleSupportsOperatingMembership,
  UserOperatingCompanyValidationError,
} from '../operating-companies/userOperatingCompany.service.js';
import { allowedTeamLeaderIdsForInquiryBrand } from '../operating-companies/operatingCompanyAssignment.js';
import { getOperatingCompanyPolicyFromService } from '../operating-companies/operatingCompanyPolicy.js';
import { parseMarketerAdminLevel } from '../../lib/marketerAdminLevel.js';

const router = Router();

const staffIdCardUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function parseServiceZoneIdsInput(raw: unknown): string[] | null {
  if (raw === undefined) return null;
  if (!Array.isArray(raw)) {
    throw new ServiceZoneValidationError('serviceZoneIds는 배열이어야 합니다.');
  }
  return Array.from(new Set(raw.map((v) => String(v ?? '').trim()).filter(Boolean)));
}

const MANAGEABLE_STAFF_ROLES = ['TEAM_LEADER', 'MARKETER', 'OFFICE_STAFF', 'EXTERNAL_PARTNER'] as const;
const STAFF_ID_CARD_ROLES = ['TEAM_LEADER', 'MARKETER'] as const;

router.use(authMiddleware);

const assignableUserSelect = {
  id: true,
  email: true,
  name: true,
  phone: true,
  role: true,
  hireDate: true,
  resignationDate: true,
  allowSelfDayOffEdit: true,
  payrollMonthlySalary: true,
  payrollPayDay: true,
  teamLeaderGeneralSettlementMode: true,
  teamLeaderGeneralSettlementValue: true,
  teamLeaderAdditionalReceiptCompanyShareBps: true,
  staffIdCardUrl: true,
  externalCompany: { select: { id: true, name: true } },
} as const;

function mapAssignableUserRow(
  u: {
    id: string;
    email: string;
    name: string;
    phone: string | null;
    role: string;
    allowSelfDayOffEdit: boolean;
    payrollMonthlySalary: number | null;
    payrollPayDay: number | null;
    teamLeaderGeneralSettlementMode: TeamLeaderGeneralSettlementMode | null;
    teamLeaderGeneralSettlementValue: number | null;
    teamLeaderAdditionalReceiptCompanyShareBps: number | null;
    staffIdCardUrl: string | null;
    externalCompany: { id: string; name: string } | null;
    hireDate: Date | null;
    resignationDate: Date | null;
  },
  operatingCompanies?: Awaited<ReturnType<typeof listOperatingCompaniesByUserIds>> extends Map<string, infer V>
    ? V
    : never,
  serviceZones?: Array<{ id: string; name: string }>,
) {
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    phone: u.phone,
    role: u.role,
    externalCompanyId: u.externalCompany?.id ?? null,
    externalCompanyName: u.externalCompany?.name ?? null,
    allowSelfDayOffEdit: u.role === 'TEAM_LEADER' ? u.allowSelfDayOffEdit : true,
    payrollMonthlySalary: u.payrollMonthlySalary ?? null,
    payrollPayDay: u.payrollPayDay ?? null,
    teamLeaderGeneralSettlementMode: u.teamLeaderGeneralSettlementMode ?? null,
    teamLeaderGeneralSettlementValue: u.teamLeaderGeneralSettlementValue ?? null,
    teamLeaderAdditionalReceiptCompanyShareBps: u.teamLeaderAdditionalReceiptCompanyShareBps ?? null,
    staffIdCardUrl: u.staffIdCardUrl ?? null,
    operatingCompanies,
    serviceZones,
    ...serializeUserDates(u),
  };
}

/** 스케줄·접수 분배 드롭다운 — 팀장+타업체, strict 정책 시 operatingCompanyId 로 팀장 필터 */
router.get('/assignable-schedule', adminOrMarketer, async (req, res) => {
  const authUser = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(authUser);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const employedOnRaw = typeof req.query.employedOn === 'string' ? req.query.employedOn.trim() : '';
  const employedOn = YMD.test(employedOnRaw) ? employedOnRaw : kstTodayYmd();
  const operatingCompanyId =
    typeof req.query.operatingCompanyId === 'string' ? req.query.operatingCompanyId.trim() : '';
  const serviceZoneId =
    typeof req.query.serviceZoneId === 'string' ? req.query.serviceZoneId.trim() : '';

  const [leaders, partners, policy] = await Promise.all([
    prisma.user.findMany({
      where: { tenantId, role: 'TEAM_LEADER', isActive: true },
      select: assignableUserSelect,
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      where: { tenantId, role: 'EXTERNAL_PARTNER', isActive: true },
      select: assignableUserSelect,
      orderBy: { name: 'asc' },
    }),
    getOperatingCompanyPolicyFromService(tenantId),
  ]);

  let leaderOut = leaders.filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, employedOn));
  if (isTeamPreviewAdminEmail(authUser.email)) {
    const selfAdmin = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: assignableUserSelect,
    });
    if (
      selfAdmin &&
      selfAdmin.role === 'ADMIN' &&
      isTeamPreviewAdminEmail(selfAdmin.email) &&
      !leaderOut.some((u) => u.id === selfAdmin.id)
    ) {
      leaderOut = [...leaderOut, selfAdmin].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }
  }

  const allowedLeaderIds = await allowedTeamLeaderIdsForInquiryBrand(
    prisma,
    tenantId,
    operatingCompanyId || null,
    leaderOut.map((u) => u.id),
  );
  leaderOut = leaderOut.filter((u) => allowedLeaderIds.has(u.id));

  if (serviceZoneId) {
    const inZone = await filterTeamLeaderIdsInServiceZone(
      prisma,
      tenantId,
      serviceZoneId,
      leaderOut.map((u) => u.id),
    );
    leaderOut = leaderOut.filter((u) => inZone.has(u.id));
  }

  const partnerOut = partners.filter((u) =>
    isUserEmployedOnYmd(u.hireDate, u.resignationDate, employedOn),
  );

  const ocByUser = await listOperatingCompaniesByUserIds(prisma, tenantId, [
    ...leaderOut.map((u) => u.id),
    ...partnerOut.map((u) => u.id),
  ]);

  res.json({
    items: [
      ...leaderOut.map((u) => mapAssignableUserRow(u, ocByUser.get(u.id))),
      ...partnerOut.map((u) => mapAssignableUserRow(u, ocByUser.get(u.id))),
    ],
    policy: {
      assignmentMode: policy.assignmentMode,
      teamLeaderListMode: policy.teamLeaderListMode,
    },
  });
});

/** 목록 조회 — 스케줄·접수에서 팀장/마케터 선택용 (기본: 해당일 재직자만) · scope=management 는 전체(관리자) */
router.get('/', adminOrMarketer, async (req, res) => {
  const authUser = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(authUser);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const role = (req.query.role as string) || 'TEAM_LEADER';
  const validRoles = ['TEAM_LEADER', 'MARKETER', 'OFFICE_STAFF', 'EXTERNAL_PARTNER', 'ADMIN'];
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
  const employmentStatusRaw =
    typeof req.query.employmentStatus === 'string' ? req.query.employmentStatus.trim() : '';
  const employmentStatus: EmploymentStatusFilter =
    employmentStatusRaw === 'resigned' || employmentStatusRaw === 'all'
      ? employmentStatusRaw
      : 'active';

  const users = await prisma.user.findMany({
    where: { tenantId, role: role as 'TEAM_LEADER' | 'MARKETER' | 'OFFICE_STAFF' | 'EXTERNAL_PARTNER' | 'ADMIN', isActive: true },
    select: {
      id: true,
      email: true,
      name: true,
      phone: true,
      role: true,
      hireDate: true,
      resignationDate: true,
      allowSelfDayOffEdit: true,
      marketerAdminLevel: true,
      payrollMonthlySalary: true,
      payrollPayDay: true,
      teamLeaderGeneralSettlementMode: true,
      teamLeaderGeneralSettlementValue: true,
      teamLeaderAdditionalReceiptCompanyShareBps: true,
      staffIdCardUrl: true,
      externalCompany: { select: { id: true, name: true } },
    },
    orderBy: { name: 'asc' },
  });

  let out = users;
  if (management) {
    out = filterByEmploymentStatus(users, employmentStatus, kstTodayYmd());
  } else {
    out = users.filter((u) => isUserEmployedOnYmd(u.hireDate, u.resignationDate, employedOn));
  }

  /** 접수자(마케터·관리자) 목록에서 team-preview 개발 계정 제외 */
  if (role === 'MARKETER' || role === 'ADMIN') {
    out = out.filter((u) => !isTeamPreviewAdminEmail(u.email));
  }

  /**
   * 개발자(team-preview-admin)는 본인 ADMIN 계정을 팀장 드롭다운에도 노출한다.
   * - 대상: role=TEAM_LEADER 조회일 때만 (마케터·타업체 목록과는 무관)
   * - 요청자 본인이 team-preview-admin 이메일일 때만 추가 — 다른 관리자/마케터에는 노출되지 않는다.
   * - 같은 id가 외부 조회(management 전체)에서도 중복되지 않도록 주의.
   */
  if (role === 'TEAM_LEADER' && !management && isTeamPreviewAdminEmail(authUser.email)) {
    const selfAdmin = await prisma.user.findUnique({
      where: { id: authUser.userId },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        hireDate: true,
        resignationDate: true,
        allowSelfDayOffEdit: true,
        marketerAdminLevel: true,
        payrollMonthlySalary: true,
        payrollPayDay: true,
        teamLeaderGeneralSettlementMode: true,
        teamLeaderGeneralSettlementValue: true,
        teamLeaderAdditionalReceiptCompanyShareBps: true,
        staffIdCardUrl: true,
        externalCompany: { select: { id: true, name: true } },
      },
    });
    if (
      selfAdmin &&
      selfAdmin.role === 'ADMIN' &&
      isTeamPreviewAdminEmail(selfAdmin.email) &&
      !out.some((u) => u.id === selfAdmin.id)
    ) {
      out = [...out, selfAdmin].sort((a, b) => a.name.localeCompare(b.name, 'ko'));
    }
  }

  const ocByUser =
    management && (role === 'TEAM_LEADER' || role === 'MARKETER')
      ? await listOperatingCompaniesByUserIds(
          prisma,
          tenantId,
          out.map((u) => u.id),
        )
      : null;

  const szByUser =
    management && role === 'TEAM_LEADER'
      ? await listServiceZonesByUserIds(
          prisma,
          tenantId,
          out.map((u) => u.id),
        )
      : null;

  res.json(
    out.map((u) => ({
      id: u.id,
      email: u.email,
      name: u.name,
      phone: u.phone,
      role: u.role,
      externalCompanyId: u.externalCompany?.id ?? null,
      externalCompanyName: u.externalCompany?.name ?? null,
      allowSelfDayOffEdit: u.role === 'TEAM_LEADER' ? u.allowSelfDayOffEdit : true,
      marketerAdminLevel: u.role === 'MARKETER' ? u.marketerAdminLevel : 'NONE',
      payrollMonthlySalary: u.payrollMonthlySalary ?? null,
      payrollPayDay: u.payrollPayDay ?? null,
      teamLeaderGeneralSettlementMode: u.teamLeaderGeneralSettlementMode ?? null,
      teamLeaderGeneralSettlementValue: u.teamLeaderGeneralSettlementValue ?? null,
      teamLeaderAdditionalReceiptCompanyShareBps: u.teamLeaderAdditionalReceiptCompanyShareBps ?? null,
      staffIdCardUrl: u.staffIdCardUrl ?? null,
      operatingCompanies: ocByUser?.get(u.id) ?? undefined,
      serviceZones: szByUser?.get(u.id) ?? undefined,
      ...serializeUserDates(u),
    }))
  );
});

/** 활성 팀장 전원의 본인 휴무일 등록 허용 일괄 변경 */
router.post('/team-leaders/day-off-self-edit', adminOnly, async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const body = req.body as { enabled?: unknown };
  if (typeof body.enabled !== 'boolean') {
    res.status(400).json({ error: 'enabled(boolean)가 필요합니다.' });
    return;
  }
  const r = await prisma.user.updateMany({
    where: { tenantId, role: 'TEAM_LEADER', isActive: true },
    data: { allowSelfDayOffEdit: body.enabled },
  });
  res.json({ ok: true, updated: r.count });
});

router.post('/', adminOnly, async (req, res) => {
  const authUser = (req as unknown as { user: AuthPayload }).user;
  const tenantId = getTenantIdFromAuth(authUser);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const body = req.body as {
    email?: string;
    password?: string;
    name?: string;
    phone?: string;
    role?: 'TEAM_LEADER' | 'MARKETER' | 'OFFICE_STAFF';
    payrollMonthlySalary?: unknown;
    payrollPayDay?: unknown;
    teamLeaderGeneralSettlementMode?: TeamLeaderGeneralSettlementMode | null | string;
    teamLeaderGeneralSettlementValue?: unknown;
    teamLeaderAdditionalReceiptCompanyShareBps?: unknown;
    operatingCompanyIds?: unknown;
    primaryOperatingCompanyId?: unknown;
    serviceZoneIds?: unknown;
  };
  const { email, password, name, phone, role } = body;
  if (!email || !password || !name) {
    res.status(400).json({ error: '아이디, 비밀번호, 이름을 입력해주세요.' });
    return;
  }
  let loginId: string;
  try {
    loginId = assertValidTenantLoginId(email);
  } catch (e) {
    res.status(400).json({ error: e instanceof Error ? e.message : '유효하지 않은 아이디입니다.' });
    return;
  }
  const userRole =
    role === 'MARKETER' ? 'MARKETER' : role === 'OFFICE_STAFF' ? 'OFFICE_STAFF' : 'TEAM_LEADER';
  const existing = await prisma.user.findUnique({
    where: { tenantId_email: { tenantId, email: loginId } },
  });
  if (existing) {
    res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
    return;
  }

  let payrollMonthlySalary: number | null | undefined;
  let payrollPayDay: number | null | undefined;

  if (userRole === 'TEAM_LEADER' || userRole === 'MARKETER' || userRole === 'OFFICE_STAFF') {
    if (body.payrollMonthlySalary !== undefined) {
      const v = body.payrollMonthlySalary;
      if (v === null || v === '') {
        payrollMonthlySalary = null;
      } else {
        const n =
          typeof v === 'number'
            ? Math.trunc(v)
            : parseInt(String(v).replace(/,/g, '').trim(), 10);
        if (!Number.isFinite(n) || n < 0) {
          res.status(400).json({ error: '월 급여는 0 이상 정수(원)이어야 합니다.' });
          return;
        }
        payrollMonthlySalary = n;
      }
    }
    if (body.payrollPayDay !== undefined) {
      const v = body.payrollPayDay;
      if (v === null || v === '') {
        payrollPayDay = null;
      } else {
        const d = typeof v === 'number' ? v : parseInt(String(v).trim(), 10);
        if (!Number.isFinite(d) || d < 1 || d > 31) {
          res.status(400).json({ error: '급여 지급일은 1~31 또는 비움(말일)입니다.' });
          return;
        }
        payrollPayDay = d;
      }
    }
  }

  let teamLeaderGeneralSettlementMode: TeamLeaderGeneralSettlementMode | null | undefined;
  let teamLeaderGeneralSettlementValue: number | null | undefined;
  let teamLeaderAdditionalReceiptCompanyShareBps: number | null | undefined;

  const TL_GEN_MODES_POST = new Set<string>(['FIXED_PER_JOB_WON', 'PERCENT_OF_GENERAL_SERVICE_BPS']);

  if (userRole === 'TEAM_LEADER') {
    if (body.teamLeaderGeneralSettlementMode !== undefined) {
      const v = body.teamLeaderGeneralSettlementMode;
      if (v === null || v === '') {
        teamLeaderGeneralSettlementMode = null;
      } else if (typeof v === 'string' && TL_GEN_MODES_POST.has(v)) {
        teamLeaderGeneralSettlementMode = v as TeamLeaderGeneralSettlementMode;
      } else {
        res.status(400).json({ error: '일반 정산 방식 값이 올바르지 않습니다.' });
        return;
      }
    }
    if (body.teamLeaderGeneralSettlementValue !== undefined) {
      const v = body.teamLeaderGeneralSettlementValue;
      if (v === null || v === '') {
        teamLeaderGeneralSettlementValue = null;
      } else {
        const n =
          typeof v === 'number'
            ? Math.trunc(v)
            : parseInt(String(v).replace(/,/g, '').trim(), 10);
        if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
          res.status(400).json({ error: '일반 정산 값은 0 이상 정수(상한 1억)여야 합니다.' });
          return;
        }
        teamLeaderGeneralSettlementValue = n;
      }
    }
    if (body.teamLeaderAdditionalReceiptCompanyShareBps !== undefined) {
      const v = body.teamLeaderAdditionalReceiptCompanyShareBps;
      if (v === null || v === '') {
        teamLeaderAdditionalReceiptCompanyShareBps = null;
      } else {
        const n = typeof v === 'number' ? Math.trunc(v) : parseInt(String(v).trim(), 10);
        if (!Number.isFinite(n) || n < 0 || n > 10000) {
          res.status(400).json({ error: '추가결재 회사 몫은 0~10000(만분율) 사이여야 합니다.' });
          return;
        }
        teamLeaderAdditionalReceiptCompanyShareBps = n;
      }
    }
  }

  let membershipInput = null;
  let serviceZoneIdsInput: string[] | null = null;
  if (userRole === 'TEAM_LEADER' && body.serviceZoneIds !== undefined) {
    try {
      serviceZoneIdsInput = parseServiceZoneIdsInput(body.serviceZoneIds);
    } catch (e) {
      if (e instanceof ServiceZoneValidationError) {
        res.status(400).json({ error: e.message });
        return;
      }
      throw e;
    }
  }
  if (userRoleSupportsOperatingMembership(userRole)) {
    try {
      membershipInput = parseUserOperatingCompanyMembershipInput(body);
    } catch (e) {
      if (e instanceof UserOperatingCompanyValidationError) {
        res.status(400).json({ error: e.message });
        return;
      }
      throw e;
    }
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await prisma.$transaction(async (tx) => {
    const created = await tx.user.create({
      data: {
        tenantId,
        email: loginId,
        passwordHash,
        name,
        phone: phone || null,
        role: userRole,
        ...(payrollMonthlySalary !== undefined ? { payrollMonthlySalary } : {}),
        ...(payrollPayDay !== undefined ? { payrollPayDay } : {}),
        ...(userRole === 'TEAM_LEADER' && teamLeaderGeneralSettlementMode !== undefined
          ? { teamLeaderGeneralSettlementMode }
          : {}),
        ...(userRole === 'TEAM_LEADER' && teamLeaderGeneralSettlementValue !== undefined
          ? { teamLeaderGeneralSettlementValue }
          : {}),
        ...(userRole === 'TEAM_LEADER' && teamLeaderAdditionalReceiptCompanyShareBps !== undefined
          ? { teamLeaderAdditionalReceiptCompanyShareBps }
          : {}),
      },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        hireDate: true,
        resignationDate: true,
        allowSelfDayOffEdit: true,
        payrollMonthlySalary: true,
        payrollPayDay: true,
        teamLeaderGeneralSettlementMode: true,
        teamLeaderGeneralSettlementValue: true,
        teamLeaderAdditionalReceiptCompanyShareBps: true,
        staffIdCardUrl: true,
      },
    });
    if (membershipInput) {
      await syncUserOperatingCompanies(tx, tenantId, created.id, membershipInput);
    } else {
      await ensureDefaultMembershipForUser(tx, tenantId, created.id, userRole);
    }
    if (userRole === 'TEAM_LEADER' && serviceZoneIdsInput !== null) {
      await replaceUserServiceZones(tx, tenantId, created.id, serviceZoneIdsInput);
    }
    return created;
  });
  res.status(201).json({
    ...user,
    allowSelfDayOffEdit: user.role === 'TEAM_LEADER' ? user.allowSelfDayOffEdit : true,
    payrollMonthlySalary: user.payrollMonthlySalary ?? null,
    payrollPayDay: user.payrollPayDay ?? null,
    teamLeaderGeneralSettlementMode: user.teamLeaderGeneralSettlementMode ?? null,
    teamLeaderGeneralSettlementValue: user.teamLeaderGeneralSettlementValue ?? null,
    teamLeaderAdditionalReceiptCompanyShareBps:
      user.teamLeaderAdditionalReceiptCompanyShareBps ?? null,
    staffIdCardUrl: user.staffIdCardUrl ?? null,
    ...serializeUserDates(user),
  });
});

/** 관리자: 팀장·마케터 영업 업체 다중 소속 */
router.put('/:id/operating-companies', adminOnly, async (req, res) => {
  const authUser = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, authUser);
  if (!tenantId) return;

  const existing = await prisma.user.findFirst({
    where: { id: req.params.id, tenantId },
    select: { id: true, role: true },
  });
  if (!existing || !userRoleSupportsOperatingMembership(existing.role)) {
    res.status(404).json({ error: '영업 업체 소속을 설정할 사용자를 찾을 수 없습니다.' });
    return;
  }

  try {
    const input = parseUserOperatingCompanyMembershipInput(req.body as Record<string, unknown>);
    if (!input) {
      res.status(400).json({ error: 'operatingCompanyIds와 primaryOperatingCompanyId가 필요합니다.' });
      return;
    }
    await syncUserOperatingCompanies(prisma, tenantId, existing.id, input);
    const map = await listOperatingCompaniesByUserIds(prisma, tenantId, [existing.id]);
    res.json({ operatingCompanies: map.get(existing.id) ?? [] });
  } catch (e) {
    if (e instanceof UserOperatingCompanyValidationError) {
      res.status(400).json({ error: e.message });
      return;
    }
    throw e;
  }
});

/** 관리자: 팀장·마케터 사원증 이미지 업로드 (Cloudinary) */
router.post('/:id/staff-id-card', adminOnly, staffIdCardUpload.single('image'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  if (!isCloudinaryConfigured()) {
    res.status(503).json({
      error:
        '이미지 업로드를 사용할 수 없습니다. 서버에 CLOUDINARY_URL 또는 CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET을 설정하세요.',
    });
    return;
  }
  const { id } = req.params;
  const file = req.file;
  if (!file?.buffer?.length) {
    res.status(400).json({ error: '이미지 파일을 선택해 주세요.' });
    return;
  }
  const mime = file.mimetype || '';
  if (!mime.startsWith('image/')) {
    res.status(400).json({ error: '이미지 파일만 업로드할 수 있습니다.' });
    return;
  }
  const owned = await prisma.user.findFirst({
    where: { id, tenantId, role: { in: [...STAFF_ID_CARD_ROLES] } },
    select: { id: true },
  });
  if (!owned) {
    res.status(404).json({ error: '사용자를 찾을 수 없거나 사원증을 등록할 수 있는 역할이 아닙니다.' });
    return;
  }
  try {
    const { staffIdCardUrl } = await replaceStaffIdCardForUser(id, file.buffer, mime);
    res.json({ staffIdCardUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'user_not_found_or_invalid_role') {
      res.status(404).json({ error: '사용자를 찾을 수 없거나 사원증을 등록할 수 있는 역할이 아닙니다.' });
      return;
    }
    console.error('[users] staff-id-card upload:', e);
    res.status(500).json({ error: '업로드에 실패했습니다.' });
  }
});

/** 관리자: 팀장·마케터 사원증 이미지 삭제 */
router.delete('/:id/staff-id-card', adminOnly, async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { id } = req.params;
  const owned = await prisma.user.findFirst({
    where: { id, tenantId, role: { in: [...STAFF_ID_CARD_ROLES] } },
    select: { id: true },
  });
  if (!owned) {
    res.status(404).json({ error: '사용자를 찾을 수 없거나 사원증을 등록할 수 있는 역할이 아닙니다.' });
    return;
  }
  try {
    await clearStaffIdCardForUser(id);
    res.json({ ok: true, staffIdCardUrl: null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'user_not_found_or_invalid_role') {
      res.status(404).json({ error: '사용자를 찾을 수 없거나 사원증을 등록할 수 있는 역할이 아닙니다.' });
      return;
    }
    console.error('[users] staff-id-card delete:', e);
    res.status(500).json({ error: '삭제에 실패했습니다.' });
  }
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
    allowSelfDayOffEdit?: boolean;
    /** @deprecated marketerAdminLevel 사용 */
    hasAdminPrivileges?: boolean;
    marketerAdminLevel?: MarketerAdminLevel | string;
    payrollMonthlySalary?: number | null;
    payrollPayDay?: number | null;
    teamLeaderGeneralSettlementMode?: TeamLeaderGeneralSettlementMode | null | string;
    teamLeaderGeneralSettlementValue?: number | null | string;
    teamLeaderAdditionalReceiptCompanyShareBps?: number | string | null;
    operatingCompanyIds?: unknown;
    primaryOperatingCompanyId?: unknown;
    serviceZoneIds?: unknown;
  };
  const authUser = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, authUser);
  if (!tenantId) return;

  let membershipInput: ReturnType<typeof parseUserOperatingCompanyMembershipInput> = null;
  let serviceZoneIdsInput: string[] | null = null;
  if (body.operatingCompanyIds !== undefined || body.primaryOperatingCompanyId !== undefined) {
    try {
      membershipInput = parseUserOperatingCompanyMembershipInput(body);
    } catch (e) {
      if (e instanceof UserOperatingCompanyValidationError) {
        res.status(400).json({ error: e.message });
        return;
      }
      throw e;
    }
  }

  const wantsEmploymentDates =
    body.hireDate !== undefined || body.resignationDate !== undefined;
  if (wantsEmploymentDates && !isTenantOwnerAdmin(authUser)) {
    res.status(403).json({ error: '입사일·퇴사일은 최고 관리자만 변경할 수 있습니다.' });
    return;
  }

  const existing = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      role: true,
      email: true,
      tenantId: true,
      hireDate: true,
      resignationDate: true,
      payrollMonthlySalary: true,
      payrollPayDay: true,
    },
  });
  if (
    !existing ||
    existing.tenantId !== tenantId ||
    (existing.role !== 'TEAM_LEADER' &&
      existing.role !== 'MARKETER' &&
      existing.role !== 'OFFICE_STAFF' &&
      existing.role !== 'EXTERNAL_PARTNER')
  ) {
    res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }

  if (body.serviceZoneIds !== undefined) {
    if (existing.role !== 'TEAM_LEADER') {
      res.status(400).json({ error: '서비스 권역은 팀장 계정만 설정할 수 있습니다.' });
      return;
    }
    try {
      serviceZoneIdsInput = parseServiceZoneIdsInput(body.serviceZoneIds);
    } catch (e) {
      if (e instanceof ServiceZoneValidationError) {
        res.status(400).json({ error: e.message });
        return;
      }
      throw e;
    }
  }

  const data: {
    email?: string;
    name?: string;
    phone?: string | null;
    passwordHash?: string;
    hireDate?: Date | null;
    resignationDate?: Date | null;
    allowSelfDayOffEdit?: boolean;
    marketerAdminLevel?: MarketerAdminLevel;
    payrollMonthlySalary?: number | null;
    payrollPayDay?: number | null;
    teamLeaderGeneralSettlementMode?: TeamLeaderGeneralSettlementMode | null;
    teamLeaderGeneralSettlementValue?: number | null;
    teamLeaderAdditionalReceiptCompanyShareBps?: number | null;
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
    let newLoginId: string;
    try {
      newLoginId = assertValidTenantLoginId(String(body.email));
    } catch (e) {
      res.status(400).json({ error: e instanceof Error ? e.message : '유효하지 않은 아이디입니다.' });
      return;
    }
    if (newLoginId !== existing.email.toLowerCase()) {
      const taken = await prisma.user.findFirst({
        where: { tenantId: existing.tenantId, email: newLoginId, NOT: { id } },
      });
      if (taken) {
        res.status(400).json({ error: '이미 사용 중인 아이디입니다.' });
        return;
      }
      data.email = newLoginId;
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

  if (body.allowSelfDayOffEdit !== undefined) {
    if (existing.role !== 'TEAM_LEADER') {
      res.status(400).json({ error: '본인 휴무 등록 허용은 팀장 계정만 변경할 수 있습니다.' });
      return;
    }
    data.allowSelfDayOffEdit = Boolean(body.allowSelfDayOffEdit);
  }

  if (body.marketerAdminLevel !== undefined || body.hasAdminPrivileges !== undefined) {
    if (authUser.role !== 'ADMIN') {
      res.status(403).json({ error: '마케터 권한 설정은 관리자(ADMIN)만 변경할 수 있습니다.' });
      return;
    }
    if (existing.role !== 'MARKETER') {
      res.status(400).json({ error: '관리자 권한은 마케터 계정만 변경할 수 있습니다.' });
      return;
    }
    if (body.marketerAdminLevel !== undefined) {
      const level = parseMarketerAdminLevel(body.marketerAdminLevel);
      if (!level) {
        res.status(400).json({ error: 'marketerAdminLevel은 NONE, LIMITED, FULL 중 하나여야 합니다.' });
        return;
      }
      data.marketerAdminLevel = level;
    } else {
      data.marketerAdminLevel = body.hasAdminPrivileges ? ('LIMITED' as MarketerAdminLevel) : ('NONE' as MarketerAdminLevel);
    }
  }

  const payrollRoleOk =
    existing.role === 'TEAM_LEADER' ||
    existing.role === 'MARKETER' ||
    existing.role === 'OFFICE_STAFF';

  if (body.payrollMonthlySalary !== undefined) {
    if (!payrollRoleOk) {
      res.status(400).json({ error: '급여 설정은 팀장·마케터·사무직 계정만 변경할 수 있습니다.' });
      return;
    }
    const v = body.payrollMonthlySalary;
    if (v === null) {
      data.payrollMonthlySalary = null;
    } else {
      const n = typeof v === 'number' ? Math.trunc(v) : parseInt(String(v).replace(/,/g, '').trim(), 10);
      if (!Number.isFinite(n) || n < 0) {
        res.status(400).json({ error: '월 급여는 0 이상 정수(원)이어야 합니다.' });
        return;
      }
      data.payrollMonthlySalary = n;
    }
  }

  if (body.payrollPayDay !== undefined) {
    if (!payrollRoleOk) {
      res.status(400).json({ error: '급여 설정은 팀장·마케터·사무직 계정만 변경할 수 있습니다.' });
      return;
    }
    const v = body.payrollPayDay;
    if (v === null) {
      data.payrollPayDay = null;
    } else {
      const d = typeof v === 'number' ? v : parseInt(String(v).trim(), 10);
      if (!Number.isFinite(d) || d < 1 || d > 31) {
        res.status(400).json({ error: '급여 지급일은 1~31 또는 비움(말일)입니다.' });
        return;
      }
      data.payrollPayDay = d;
    }
  }

  const TL_GEN_MODES = new Set<string>(['FIXED_PER_JOB_WON', 'PERCENT_OF_GENERAL_SERVICE_BPS']);

  if (body.teamLeaderGeneralSettlementMode !== undefined) {
    if (existing.role !== 'TEAM_LEADER') {
      res.status(400).json({ error: '일반 정산 방식은 팀장 계정만 변경할 수 있습니다.' });
      return;
    }
    const v = body.teamLeaderGeneralSettlementMode;
    if (v === null || v === '') {
      data.teamLeaderGeneralSettlementMode = null;
    } else if (typeof v === 'string' && TL_GEN_MODES.has(v)) {
      data.teamLeaderGeneralSettlementMode = v as TeamLeaderGeneralSettlementMode;
    } else {
      res.status(400).json({ error: '일반 정산 방식 값이 올바르지 않습니다.' });
      return;
    }
  }

  if (body.teamLeaderGeneralSettlementValue !== undefined) {
    if (existing.role !== 'TEAM_LEADER') {
      res.status(400).json({ error: '일반 정산 금액·비율은 팀장 계정만 변경할 수 있습니다.' });
      return;
    }
    const v = body.teamLeaderGeneralSettlementValue;
    if (v === null || v === '') {
      data.teamLeaderGeneralSettlementValue = null;
    } else {
      const n =
        typeof v === 'number'
          ? Math.trunc(v)
          : parseInt(String(v).replace(/,/g, '').trim(), 10);
      if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
        res.status(400).json({ error: '일반 정산 값은 0 이상 정수(상한 1억)여야 합니다.' });
        return;
      }
      data.teamLeaderGeneralSettlementValue = n;
    }
  }

  if (body.teamLeaderAdditionalReceiptCompanyShareBps !== undefined) {
    if (existing.role !== 'TEAM_LEADER') {
      res.status(400).json({ error: '추가결재 회사 몫 비율은 팀장 계정만 변경할 수 있습니다.' });
      return;
    }
    const v = body.teamLeaderAdditionalReceiptCompanyShareBps;
    if (v === null || v === '') {
      data.teamLeaderAdditionalReceiptCompanyShareBps = null;
    } else {
      const n = typeof v === 'number' ? Math.trunc(v) : parseInt(String(v).trim(), 10);
      if (!Number.isFinite(n) || n < 0 || n > 10000) {
        res.status(400).json({ error: '추가결재 회사 몫은 0~10000(만분율) 사이여야 합니다.' });
        return;
      }
      data.teamLeaderAdditionalReceiptCompanyShareBps = n;
    }
  }

  if (membershipInput && !userRoleSupportsOperatingMembership(existing.role)) {
    res.status(400).json({ error: '팀장·마케터만 영업 업체 소속을 설정할 수 있습니다.' });
    return;
  }

  const userSelect = {
    id: true,
    email: true,
    name: true,
    phone: true,
    role: true,
    hireDate: true,
    resignationDate: true,
    allowSelfDayOffEdit: true,
    marketerAdminLevel: true,
    payrollMonthlySalary: true,
    payrollPayDay: true,
    teamLeaderGeneralSettlementMode: true,
    teamLeaderGeneralSettlementValue: true,
    teamLeaderAdditionalReceiptCompanyShareBps: true,
    staffIdCardUrl: true,
  } as const;

  if (Object.keys(data).length === 0 && !membershipInput && serviceZoneIdsInput === null) {
    const u = await prisma.user.findUnique({ where: { id }, select: userSelect });
    if (!u) {
      res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
      return;
    }
    res.json({
      ...u,
      allowSelfDayOffEdit: u.role === 'TEAM_LEADER' ? u.allowSelfDayOffEdit : true,
      marketerAdminLevel: u.role === 'MARKETER' ? u.marketerAdminLevel : 'NONE',
      payrollMonthlySalary: u.payrollMonthlySalary ?? null,
      payrollPayDay: u.payrollPayDay ?? null,
      teamLeaderGeneralSettlementMode: u.teamLeaderGeneralSettlementMode ?? null,
      teamLeaderGeneralSettlementValue: u.teamLeaderGeneralSettlementValue ?? null,
      teamLeaderAdditionalReceiptCompanyShareBps: u.teamLeaderAdditionalReceiptCompanyShareBps ?? null,
      staffIdCardUrl: u.staffIdCardUrl ?? null,
      ...serializeUserDates(u),
    });
    return;
  }

  const updated = await prisma.$transaction(async (tx) => {
    const u =
      Object.keys(data).length > 0
        ? await tx.user.update({ where: { id }, data, select: userSelect })
        : await tx.user.findUniqueOrThrow({ where: { id }, select: userSelect });
    if (membershipInput && userRoleSupportsOperatingMembership(u.role)) {
      await syncUserOperatingCompanies(tx, tenantId, id, membershipInput);
    }
    if (serviceZoneIdsInput !== null && u.role === 'TEAM_LEADER') {
      await replaceUserServiceZones(tx, tenantId, id, serviceZoneIdsInput);
    }
    return u;
  });

  const ocMap =
    userRoleSupportsOperatingMembership(updated.role)
      ? await listOperatingCompaniesByUserIds(prisma, tenantId, [updated.id])
      : null;
  const szMap =
    updated.role === 'TEAM_LEADER'
      ? await listServiceZonesByUserIds(prisma, tenantId, [updated.id])
      : null;

  res.json({
    ...updated,
    allowSelfDayOffEdit: updated.role === 'TEAM_LEADER' ? updated.allowSelfDayOffEdit : true,
    marketerAdminLevel: updated.role === 'MARKETER' ? updated.marketerAdminLevel : 'NONE',
    payrollMonthlySalary: updated.payrollMonthlySalary ?? null,
    payrollPayDay: updated.payrollPayDay ?? null,
    teamLeaderGeneralSettlementMode: updated.teamLeaderGeneralSettlementMode ?? null,
    teamLeaderGeneralSettlementValue: updated.teamLeaderGeneralSettlementValue ?? null,
    teamLeaderAdditionalReceiptCompanyShareBps:
      updated.teamLeaderAdditionalReceiptCompanyShareBps ?? null,
    staffIdCardUrl: updated.staffIdCardUrl ?? null,
    operatingCompanies: ocMap?.get(updated.id),
    serviceZones: szMap?.get(updated.id),
    ...serializeUserDates(updated),
  });
});

router.delete('/:id', adminOnly, async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { id } = req.params;
  const user = await prisma.user.findFirst({
    where: {
      id,
      tenantId,
      role: { in: [...MANAGEABLE_STAFF_ROLES] },
    },
    select: { role: true },
  });
  if (!user) {
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
