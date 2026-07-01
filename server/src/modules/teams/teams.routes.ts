import { Router, type Request } from 'express';
import multer from 'multer';
import bcrypt from 'bcryptjs';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, adminOrOperationalMarketer } from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import type { AuthPayload } from '../auth/auth.middleware.js';
import { isCloudinaryConfigured } from '../../lib/cloudinary.js';
import {
  clearStaffIdCardForTeamMember,
  removeTeamMemberStaffIdCardAsset,
  replaceStaffIdCardForTeamMember,
} from '../staff-id-card/staffIdCard.service.js';
import {
  getAvailableFieldStaffMemberIdsOnDate,
  poolMemberInTenantWhere,
} from '../inquiries/crewMemberCapacity.helpers.js';
import { kstMonthRangeYm } from '../inquiries/inquiryListDateRange.js';
import { dateToYmdKst, employmentOverlapsMonthKst, filterByEmploymentStatus, isUserEmployedOnYmd, kstTodayYmd, parseYmdToUtcDate, serializeUserDates, type EmploymentStatusFilter } from '../users/userEmployment.js';
import {
  crewMemberNoteIncludesTeamMember,
  payrollCycleBoundsKst,
  payrollCyclePreferredDateWhere,
} from './teamMemberPayrollCycle.js';
import { computeCrewSpacingByPoolMemberName } from './crewLeaderMemberSpacing.js';
import { findPoolMembersForAdminList } from './poolTeamMembers.service.js';
import {
  normalizeTeamMemberNameTh,
  resolveTeamMemberNationality,
} from '../../lib/teamMemberNationality.js';
import { resolveTenantIdFromAuth } from '../tenants/tenant.middleware.js';
import { requireTenantIdFromAuth } from '../tenants/tenantScope.helpers.js';
import { isTenantOwnerAdmin } from '../auth/tenantOwner.js';

const router = Router();

const staffIdCardUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const YMD = /^\d{4}-\d{2}-\d{2}$/;
/** 활성 팀원 기준 최대 인원 (표준 구성: 팀장 1 + 팀원 2) */
const MAX_ACTIVE_TEAM_MEMBERS = 2;

async function findTeamInTenant(tenantId: string, teamId: string) {
  return prisma.team.findFirst({ where: { id: teamId, tenantId } });
}

async function findPoolMemberInTenant(tenantId: string, memberId: string) {
  return prisma.teamMember.findFirst({
    where: { id: memberId, ...poolMemberInTenantWhere(tenantId) },
  });
}

async function findTeamMemberInTenantTeam(tenantId: string, teamId: string, memberId: string) {
  return prisma.teamMember.findFirst({
    where: { id: memberId, teamId, team: { tenantId } },
  });
}

router.use(authMiddleware);

/**
 * 접수 상세·스케줄에서 투입 팀원 검색 시, 선택된 팀장(자사)과 같이 마지막으로 간 예약일부터
 * 현재 편집 중 예약일까지 몇 칸의 날짜 차이인지(정보 표시만, 선택 제한 없음).
 */
router.get('/crew-leader-member-spacing', requireStaffPermission('inquiry.edit.assignment'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const teamLeaderId = typeof req.query.teamLeaderId === 'string' ? req.query.teamLeaderId.trim() : '';
  const ymdRaw = typeof req.query.preferredDate === 'string' ? req.query.preferredDate.trim() : '';
  if (!teamLeaderId) {
    res.status(400).json({ error: 'teamLeaderId가 필요합니다.' });
    return;
  }
  if (!YMD.test(ymdRaw)) {
    res.status(400).json({ error: 'preferredDate는 YYYY-MM-DD 형식이어야 합니다.' });
    return;
  }

  const leader = await prisma.user.findFirst({
    where: { id: teamLeaderId, tenantId, role: 'TEAM_LEADER', isActive: true },
    select: { id: true },
  });
  if (!leader) {
    res.status(404).json({ error: '팀장을 찾을 수 없습니다.' });
    return;
  }

  const members = await prisma.teamMember.findMany({
    where: {
      teamId: null,
      crewGroupMembers: { some: { group: { tenantId } } },
    },
    select: { name: true, nameTh: true },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });

  const spacingByMemberName = await computeCrewSpacingByPoolMemberName(prisma, {
    teamLeaderId,
    currentYmd: ymdRaw,
    poolMembers: members,
  });

  res.json({ spacingByMemberName });
});

router.get('/members', requireStaffPermission('inquiry.edit.assignment'), async (req, res) => {
  try {
    const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
    if (!tenantId) return;

    const dateRaw = typeof req.query.preferredDate === 'string' ? req.query.preferredDate.trim() : '';
    const preferredDate = YMD.test(dateRaw) ? dateRaw : null;
    const lite = req.query.lite === '1' || req.query.lite === 'true';
    const employmentStatusRaw =
      typeof req.query.employmentStatus === 'string' ? req.query.employmentStatus.trim() : '';
    const employmentStatus: EmploymentStatusFilter =
      employmentStatusRaw === 'resigned' || employmentStatusRaw === 'all'
        ? employmentStatusRaw
        : 'active';

    const members = await findPoolMembersForAdminList(prisma, tenantId);
    const todayYmd = kstTodayYmd();
    const filteredMembers = filterByEmploymentStatus(members, employmentStatus, todayYmd);

    type CycleCache = { startYmd: string; endYmd: string; inquiries: { crewMemberNote: string | null }[] };
    const inquiriesByPayDay = new Map<number, CycleCache>();

    if (!lite) {
      const distinctPayDays = [
        ...new Set(
          filteredMembers
            .map((x) => x.monthlyPayDay)
            .filter((d): d is number => d != null && d >= 1 && d <= 31),
        ),
      ].sort((a, b) => a - b);

      await Promise.all(
        distinctPayDays.map(async (payDay) => {
          const { startYmd, endYmd } = payrollCycleBoundsKst(payDay);
          const bounds = payrollCyclePreferredDateWhere(startYmd, endYmd);
          const inquiries = await prisma.inquiry.findMany({
            where: {
              tenantId,
              preferredDate: { gte: bounds.gte, lte: bounds.lte },
              status: { notIn: ['CANCELLED', 'ON_HOLD'] },
            },
            select: { crewMemberNote: true },
          });
          inquiriesByPayDay.set(payDay, { startYmd, endYmd, inquiries });
        }),
      );
    }

    let items = filteredMembers.map((m) => {
      let payCycleJobCount: number | null = null;
      let payCycleStartYmd: string | null = null;
      let payCycleEndYmd: string | null = null;
      if (!lite && m.monthlyPayDay != null) {
        const cached = inquiriesByPayDay.get(m.monthlyPayDay);
        if (cached) {
          payCycleStartYmd = cached.startYmd;
          payCycleEndYmd = cached.endYmd;
          payCycleJobCount = cached.inquiries.filter((inq) =>
            crewMemberNoteIncludesTeamMember(inq.crewMemberNote, m),
          ).length;
        }
      }
      return {
        id: m.id,
        name: m.name,
        nameTh: m.nameTh,
        nationality: m.nationality,
        phone: m.phone,
        sortOrder: m.sortOrder,
        isActive: m.isActive,
        ...serializeUserDates(m),
        monthlyPayDay: m.monthlyPayDay,
        payAmountPerJob: m.payAmountPerJob,
        createdAt: m.createdAt.toISOString(),
        dayOffCount: m._count.dayOffs,
        staffIdCardUrl: m.staffIdCardUrl ?? null,
        payCycleJobCount,
        payCycleStartYmd,
        payCycleEndYmd,
      };
    });

    if (preferredDate) {
      const hasDailyRosterAgg =
        (await prisma.teamCrewGroupMember.count({
          where: { group: { tenantId, isActive: true, availabilityMode: 'ROSTER' } },
        })) > 0;
      if (hasDailyRosterAgg) {
        const crewMemberIds = new Set(filteredMembers.map((m) => m.id));
        const pickableRaw = await getAvailableFieldStaffMemberIdsOnDate(prisma, preferredDate, tenantId);
        const pickable = new Set([...pickableRaw].filter((id) => crewMemberIds.has(id)));
        items = items.filter((row) => pickable.has(row.id));
      }
    }

    res.json({ items });
  } catch (e) {
    console.error('[GET /teams/members]', e);
    const detail = e instanceof Error ? e.message : String(e);
    const hint = /tenant_id|does not exist|42703/i.test(detail)
      ? ' DB 마이그레이션(prisma migrate deploy)이 필요합니다.'
      : '';
    res.status(500).json({ error: `팀원 목록을 불러오지 못했습니다.${hint}` });
  }
});

router.use(requireStaffPermission('admin.users'));

/**
 * 팀장별 월간 배정·상태 집계
 * - 기준: 예약일(preferredDate)이 해당 달(KST)에 속하는 접수만
 * - 배정: 해당 팀장에게 Assignment가 있는 건(행) 수
 */
router.get('/leader-monthly-stats', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const monthRaw = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  const monthKey =
    monthRaw || new Date().toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
  const range = kstMonthRangeYm(monthKey);
  if (!range) {
    res.status(400).json({ error: 'month는 YYYY-MM 형식이어야 합니다.' });
    return;
  }

  const monthStartYmd = dateToYmdKst(range.gte);
  const monthEndYmd = dateToYmdKst(range.lte);

  const leadersAll = await prisma.user.findMany({
    where: { tenantId, role: 'TEAM_LEADER', isActive: true },
    select: { id: true, name: true, hireDate: true, resignationDate: true },
    orderBy: { name: 'asc' },
  });
  const leaders = leadersAll.filter((l) =>
    employmentOverlapsMonthKst(l.hireDate, l.resignationDate, monthStartYmd, monthEndYmd)
  );

  const assignments = await prisma.assignment.findMany({
    where: {
      inquiry: {
        tenantId,
        preferredDate: { gte: range.gte, lte: range.lte },
      },
    },
    select: {
      teamLeaderId: true,
      inquiry: { select: { status: true } },
    },
  });

  const statsMap = new Map<
    string,
    { assigned: number; completed: number; incomplete: number; cancelled: number }
  >();
  for (const l of leaders) {
    statsMap.set(l.id, { assigned: 0, completed: 0, incomplete: 0, cancelled: 0 });
  }

  for (const a of assignments) {
    const stats = statsMap.get(a.teamLeaderId);
    if (!stats) continue;
    stats.assigned++;
    const st = a.inquiry.status;
    if (st === 'COMPLETED') stats.completed++;
    else if (st === 'CANCELLED') stats.cancelled++;
    else stats.incomplete++;
  }

  res.json({
    month: monthKey,
    items: leaders.map((l) => {
      const s = statsMap.get(l.id)!;
      return {
        teamLeaderId: l.id,
        name: l.name,
        assigned: s.assigned,
        completed: s.completed,
        incomplete: s.incomplete,
        cancelled: s.cancelled,
      };
    }),
  });
});

async function verifyAdminPassword(req: Request, password: unknown): Promise<boolean> {
  const p = password != null ? String(password) : '';
  if (!p) return false;
  const user = (req as unknown as { user: AuthPayload }).user;
  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!dbUser) return false;
  return bcrypt.compare(p, dbUser.passwordHash);
}

/** 팀 목록 (팀장·팀원·휴무 일부 메타는 별도 조회) */
router.get('/', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const teams = await prisma.team.findMany({
    where: { tenantId },
    orderBy: { updatedAt: 'desc' },
    include: {
      teamLeader: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
      members: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        include: {
          _count: { select: { dayOffs: true } },
        },
      },
    },
  });
  res.json({
    items: teams.map((t) => ({
      id: t.id,
      memo: t.memo,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
      teamLeader: t.teamLeader,
      members: t.members.map((m) => ({
        id: m.id,
        name: m.name,
        nameTh: m.nameTh,
        nationality: m.nationality,
        phone: m.phone,
        sortOrder: m.sortOrder,
        isActive: m.isActive,
        monthlyPayDay: m.monthlyPayDay,
        payAmountPerJob: m.payAmountPerJob,
        createdAt: m.createdAt.toISOString(),
        dayOffCount: m._count.dayOffs,
        staffIdCardUrl: m.staffIdCardUrl ?? null,
      })),
    })),
  });
});

/** 팀 생성 (팀장당 1팀) */
router.post('/', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await resolveTenantIdFromAuth(user);
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return;
  }
  const { teamLeaderId, memo } = req.body as { teamLeaderId?: string; memo?: string | null };
  if (!teamLeaderId || typeof teamLeaderId !== 'string') {
    res.status(400).json({ error: 'teamLeaderId가 필요합니다.' });
    return;
  }
  const leader = await prisma.user.findFirst({
    where: { id: teamLeaderId, tenantId, role: 'TEAM_LEADER' },
    select: { id: true, hireDate: true, resignationDate: true },
  });
  if (!leader) {
    res.status(400).json({ error: '유효한 팀장 계정을 찾을 수 없습니다.' });
    return;
  }
  if (!isUserEmployedOnYmd(leader.hireDate, leader.resignationDate, kstTodayYmd())) {
    res.status(400).json({ error: '입사·퇴사 기간에 해당하지 않는 팀장은 팀에 할당할 수 없습니다.' });
    return;
  }
  const existing = await prisma.team.findFirst({ where: { teamLeaderId, tenantId } });
  if (existing) {
    res.status(409).json({ error: '이 팀장에게 이미 팀이 등록되어 있습니다.' });
    return;
  }
  const team = await prisma.team.create({
    data: {
      tenantId,
      teamLeaderId,
      memo: memo != null && memo !== '' ? String(memo) : null,
    },
    include: {
      teamLeader: { select: { id: true, name: true, email: true, phone: true, isActive: true } },
      members: true,
    },
  });
  res.status(201).json({
    id: team.id,
    memo: team.memo,
    teamLeader: team.teamLeader,
    members: [],
  });
});

/** 전사 팀원 풀 (teamId 없음). `/:teamId`보다 먼저 등록해야 `/members`가 teamId로 오인되지 않음 */
const MAX_POOL_MEMBERS = 100;

function parseTeamMemberPayFields(body: Record<string, unknown>): {
  monthlyPayDay?: number | null;
  payAmountPerJob?: number | null;
  error?: string;
} {
  const out: { monthlyPayDay?: number | null; payAmountPerJob?: number | null } = {};
  if (Object.prototype.hasOwnProperty.call(body, 'monthlyPayDay')) {
    const v = body.monthlyPayDay;
    if (v === null || v === '') {
      out.monthlyPayDay = null;
    } else {
      const n = typeof v === 'number' ? v : parseInt(String(v).trim(), 10);
      if (!Number.isFinite(n) || n < 1 || n > 31) {
        return { error: '월급 지급일은 1~31 사이 숫자이거나 비워야 합니다.' };
      }
      out.monthlyPayDay = n;
    }
  }
  if (Object.prototype.hasOwnProperty.call(body, 'payAmountPerJob')) {
    const v = body.payAmountPerJob;
    if (v === null || v === '') {
      out.payAmountPerJob = null;
    } else {
      const n =
        typeof v === 'number'
          ? Math.trunc(v)
          : parseInt(String(v).replace(/,/g, '').trim(), 10);
      if (!Number.isFinite(n) || n < 0) {
        return { error: '일당(1일 급여)는 0 이상 정수(원)이거나 비워야 합니다.' };
      }
      out.payAmountPerJob = n;
    }
  }
  return out;
}

router.post('/members', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const body = req.body as {
    name?: string;
    nameTh?: string | null;
    phone?: string | null;
    sortOrder?: number;
    nationality?: unknown;
  };
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    res.status(400).json({ error: '이름을 입력해주세요.' });
    return;
  }
  const nationality = resolveTeamMemberNationality(body.nationality);
  const nameTh = normalizeTeamMemberNameTh(nationality, body.nameTh);
  try {
    const activePool = await prisma.teamMember.count({
      where: { ...poolMemberInTenantWhere(tenantId), isActive: true },
    });
    if (activePool >= MAX_POOL_MEMBERS) {
      res.status(400).json({
        error: `팀원은 활성 최대 ${MAX_POOL_MEMBERS}명까지 등록할 수 있습니다.`,
      });
      return;
    }
    const member = await prisma.teamMember.create({
      data: {
        tenantId,
        teamId: null,
        name: body.name.trim(),
        nameTh,
        nationality,
        phone: body.phone != null && String(body.phone).trim() ? String(body.phone).trim() : null,
        sortOrder:
          typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder) ? body.sortOrder : activePool,
      },
    });
    res.status(201).json({
      id: member.id,
      name: member.name,
      nameTh: member.nameTh,
      nationality: member.nationality,
      phone: member.phone,
      sortOrder: member.sortOrder,
      isActive: member.isActive,
      createdAt: member.createdAt.toISOString(),
    });
  } catch (e) {
    console.error('POST /teams/members:', e);
    const msg = e instanceof Error ? e.message : String(e);
    const hint =
      process.env.NODE_ENV !== 'production'
        ? msg
        : '저장 중 오류가 발생했습니다. DB 스키마(team_id nullable)를 최신으로 맞췄는지 확인하세요.';
    res.status(500).json({ error: hint });
  }
});

router.patch('/members/:memberId', async (req, res) => {
  const authUser = (req as unknown as { user: AuthPayload }).user;
  const tenantId = await requireTenantIdFromAuth(res, authUser);
  if (!tenantId) return;

  const { memberId } = req.params;
  const body = req.body as Record<string, unknown> & {
    name?: string;
    nameTh?: string | null;
    phone?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    hireDate?: string | null;
    resignationDate?: string | null;
    nationality?: unknown;
  };
  const payParsed = parseTeamMemberPayFields(body);
  if (payParsed.error) {
    res.status(400).json({ error: payParsed.error });
    return;
  }
  const wantsEmploymentDates = body.hireDate !== undefined || body.resignationDate !== undefined;
  if (wantsEmploymentDates) {
    if (!isTenantOwnerAdmin(authUser)) {
      res.status(403).json({ error: '입사일·퇴사일은 최고 관리자만 변경할 수 있습니다.' });
      return;
    }
  }
  const member = await findPoolMemberInTenant(tenantId, memberId);
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  if (body.isActive === true && !member.isActive) {
    const activePool = await prisma.teamMember.count({
      where: { ...poolMemberInTenantWhere(tenantId), isActive: true },
    });
    if (activePool >= MAX_POOL_MEMBERS) {
      res.status(400).json({
        error: `전사 팀원은 활성 최대 ${MAX_POOL_MEMBERS}명까지입니다.`,
      });
      return;
    }
  }

  let hire: Date | null | undefined;
  let resign: Date | null | undefined;
  if (wantsEmploymentDates) {
    hire = member.hireDate;
    resign = member.resignationDate;
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
  }

  const nationalityNext =
    body.nationality !== undefined ? resolveTeamMemberNationality(body.nationality) : member.nationality;
  let nameThNext = member.nameTh;
  if (body.nameTh !== undefined) {
    nameThNext = normalizeTeamMemberNameTh(nationalityNext, body.nameTh);
  } else if (body.nationality !== undefined && nationalityNext === 'KO') {
    nameThNext = null;
  }

  const updated = await prisma.teamMember.update({
    where: { id: memberId },
    data: {
      name: body.name === undefined ? undefined : String(body.name).trim() || member.name,
      nationality: body.nationality !== undefined ? nationalityNext : undefined,
      nameTh:
        body.nameTh !== undefined || (body.nationality !== undefined && nationalityNext === 'KO')
          ? nameThNext
          : undefined,
      phone: body.phone === undefined ? undefined : body.phone === null || body.phone === '' ? null : String(body.phone),
      sortOrder:
        body.sortOrder === undefined
          ? undefined
          : typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)
            ? body.sortOrder
            : member.sortOrder,
      isActive: body.isActive === undefined ? undefined : Boolean(body.isActive),
      monthlyPayDay:
        payParsed.monthlyPayDay === undefined ? undefined : payParsed.monthlyPayDay,
      payAmountPerJob:
        payParsed.payAmountPerJob === undefined ? undefined : payParsed.payAmountPerJob,
      hireDate: wantsEmploymentDates ? hire! : undefined,
      resignationDate: wantsEmploymentDates ? resign! : undefined,
    },
  });
  res.json({
    id: updated.id,
    name: updated.name,
    nameTh: updated.nameTh,
    nationality: updated.nationality,
    phone: updated.phone,
    sortOrder: updated.sortOrder,
    isActive: updated.isActive,
    ...serializeUserDates(updated),
    monthlyPayDay: updated.monthlyPayDay,
    payAmountPerJob: updated.payAmountPerJob,
    staffIdCardUrl: updated.staffIdCardUrl ?? null,
  });
});

/** 관리자: 현장 팀원 사원증 이미지 업로드 (Cloudinary) */
router.post('/members/:memberId/staff-id-card', staffIdCardUpload.single('image'), async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  if (!isCloudinaryConfigured()) {
    res.status(503).json({
      error:
        '이미지 업로드를 사용할 수 없습니다. 서버에 CLOUDINARY_URL 또는 CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET을 설정하세요.',
    });
    return;
  }
  const { memberId } = req.params;
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
  const member = await findPoolMemberInTenant(tenantId, memberId);
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  try {
    const { staffIdCardUrl } = await replaceStaffIdCardForTeamMember(memberId, file.buffer, mime);
    res.json({ staffIdCardUrl });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'team_member_not_found') {
      res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
      return;
    }
    console.error('[teams] staff-id-card upload:', e);
    res.status(500).json({ error: '업로드에 실패했습니다.' });
  }
});

router.delete('/members/:memberId/staff-id-card', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { memberId } = req.params;
  const member = await findPoolMemberInTenant(tenantId, memberId);
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  try {
    await clearStaffIdCardForTeamMember(memberId);
    res.json({ ok: true, staffIdCardUrl: null });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'team_member_not_found') {
      res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
      return;
    }
    console.error('[teams] staff-id-card delete:', e);
    res.status(500).json({ error: '삭제에 실패했습니다.' });
  }
});

router.delete('/members/:memberId', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { memberId } = req.params;
  const { password } = req.body as { password?: string };
  if (!(await verifyAdminPassword(req, password))) {
    const p = password != null ? String(password) : '';
    res.status(p ? 401 : 400).json({ error: p ? '비밀번호가 일치하지 않습니다.' : '비밀번호를 입력해주세요.' });
    return;
  }
  const member = await findPoolMemberInTenant(tenantId, memberId);
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  await removeTeamMemberStaffIdCardAsset(memberId);
  await prisma.teamMember.delete({ where: { id: memberId } });
  res.json({ ok: true });
});

router.get('/members/:memberId/day-offs', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { memberId } = req.params;
  const { start, end } = req.query as { start?: string; end?: string };
  const member = await findPoolMemberInTenant(tenantId, memberId);
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  const now = new Date();
  const startDate =
    start && YMD.test(start) ? new Date(`${start}T12:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate =
    end && YMD.test(end)
      ? new Date(`${end}T12:00:00`)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const list = await prisma.teamMemberDayOff.findMany({
    where: {
      teamMemberId: memberId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  });
  res.json({ items: list.map((d) => d.date.toISOString().slice(0, 10)) });
});

router.post('/members/:memberId/day-offs', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { memberId } = req.params;
  const { date } = req.body as { date?: string };
  if (!date || !YMD.test(date)) {
    res.status(400).json({ error: '유효한 날짜(yyyy-mm-dd)를 입력해주세요.' });
    return;
  }
  const member = await findPoolMemberInTenant(tenantId, memberId);
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  const d = new Date(`${date}T12:00:00`);
  await prisma.teamMemberDayOff.upsert({
    where: {
      teamMemberId_date: { teamMemberId: memberId, date: d },
    },
    create: { teamMemberId: memberId, date: d },
    update: {},
  });
  res.json({ ok: true });
});

router.delete('/members/:memberId/day-offs', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { memberId } = req.params;
  const { date } = req.query as { date?: string };
  if (!date || !YMD.test(date)) {
    res.status(400).json({ error: '유효한 날짜(yyyy-mm-dd)를 입력해주세요.' });
    return;
  }
  const member = await findPoolMemberInTenant(tenantId, memberId);
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  const d = new Date(`${date}T12:00:00`);
  await prisma.teamMemberDayOff.deleteMany({
    where: { teamMemberId: memberId, date: d },
  });
  res.json({ ok: true });
});

router.patch('/:teamId', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { teamId } = req.params;
  const { memo } = req.body as { memo?: string | null };
  const team = await findTeamInTenant(tenantId, teamId);
  if (!team) {
    res.status(404).json({ error: '팀을 찾을 수 없습니다.' });
    return;
  }
  const updated = await prisma.team.update({
    where: { id: teamId },
    data: { memo: memo === undefined ? undefined : memo === null || memo === '' ? null : String(memo) },
  });
  res.json({ id: updated.id, memo: updated.memo, updatedAt: updated.updatedAt.toISOString() });
});

router.delete('/:teamId', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { teamId } = req.params;
  const { password } = req.body as { password?: string };
  if (!(await verifyAdminPassword(req, password))) {
    const p = password != null ? String(password) : '';
    res.status(p ? 401 : 400).json({ error: p ? '비밀번호가 일치하지 않습니다.' : '비밀번호를 입력해주세요.' });
    return;
  }
  const team = await findTeamInTenant(tenantId, teamId);
  if (!team) {
    res.status(404).json({ error: '팀을 찾을 수 없습니다.' });
    return;
  }
  await prisma.team.delete({ where: { id: teamId } });
  res.json({ ok: true });
});

router.post('/:teamId/members', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { teamId } = req.params;
  const body = req.body as {
    name?: string;
    nameTh?: string | null;
    phone?: string | null;
    sortOrder?: number;
    nationality?: unknown;
  };
  if (!body.name || typeof body.name !== 'string' || !body.name.trim()) {
    res.status(400).json({ error: '이름을 입력해주세요.' });
    return;
  }
  const team = await findTeamInTenant(tenantId, teamId);
  if (!team) {
    res.status(404).json({ error: '팀을 찾을 수 없습니다.' });
    return;
  }
  const activeCount = await prisma.teamMember.count({
    where: { teamId, isActive: true },
  });
  if (activeCount >= MAX_ACTIVE_TEAM_MEMBERS) {
    res.status(400).json({ error: `활성 팀원은 최대 ${MAX_ACTIVE_TEAM_MEMBERS}명까지 등록할 수 있습니다.` });
    return;
  }
  const nationality = resolveTeamMemberNationality(body.nationality);
  const nameTh = normalizeTeamMemberNameTh(nationality, body.nameTh);
  const member = await prisma.teamMember.create({
    data: {
      tenantId,
      teamId,
      name: body.name.trim(),
      nameTh,
      nationality,
      phone: body.phone != null && String(body.phone).trim() ? String(body.phone).trim() : null,
      sortOrder: typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder) ? body.sortOrder : activeCount,
    },
  });
  res.status(201).json({
    id: member.id,
    name: member.name,
    nameTh: member.nameTh,
    nationality: member.nationality,
    phone: member.phone,
    sortOrder: member.sortOrder,
    isActive: member.isActive,
    createdAt: member.createdAt.toISOString(),
  });
});

router.patch('/:teamId/members/:memberId', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { teamId, memberId } = req.params;
  const body = req.body as Record<string, unknown> & {
    name?: string;
    nameTh?: string | null;
    phone?: string | null;
    sortOrder?: number;
    isActive?: boolean;
    nationality?: unknown;
  };
  const payParsed = parseTeamMemberPayFields(body);
  if (payParsed.error) {
    res.status(400).json({ error: payParsed.error });
    return;
  }
  const member = await findTeamMemberInTenantTeam(tenantId, teamId, memberId);
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  if (body.isActive === true && !member.isActive) {
    const activeCount = await prisma.teamMember.count({
      where: { teamId, isActive: true },
    });
    if (activeCount >= MAX_ACTIVE_TEAM_MEMBERS) {
      res.status(400).json({ error: `활성 팀원은 최대 ${MAX_ACTIVE_TEAM_MEMBERS}명까지입니다.` });
      return;
    }
  }
  const nationalityNext =
    body.nationality !== undefined ? resolveTeamMemberNationality(body.nationality) : member.nationality;
  let nameThNext = member.nameTh;
  if (body.nameTh !== undefined) {
    nameThNext = normalizeTeamMemberNameTh(nationalityNext, body.nameTh);
  } else if (body.nationality !== undefined && nationalityNext === 'KO') {
    nameThNext = null;
  }
  const updated = await prisma.teamMember.update({
    where: { id: memberId },
    data: {
      name: body.name === undefined ? undefined : String(body.name).trim() || member.name,
      nationality: body.nationality !== undefined ? nationalityNext : undefined,
      nameTh:
        body.nameTh !== undefined || (body.nationality !== undefined && nationalityNext === 'KO')
          ? nameThNext
          : undefined,
      phone: body.phone === undefined ? undefined : body.phone === null || body.phone === '' ? null : String(body.phone),
      sortOrder:
        body.sortOrder === undefined
          ? undefined
          : typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder)
            ? body.sortOrder
            : member.sortOrder,
      isActive: body.isActive === undefined ? undefined : Boolean(body.isActive),
      monthlyPayDay:
        payParsed.monthlyPayDay === undefined ? undefined : payParsed.monthlyPayDay,
      payAmountPerJob:
        payParsed.payAmountPerJob === undefined ? undefined : payParsed.payAmountPerJob,
    },
  });
  res.json({
    id: updated.id,
    name: updated.name,
    nameTh: updated.nameTh,
    nationality: updated.nationality,
    phone: updated.phone,
    sortOrder: updated.sortOrder,
    isActive: updated.isActive,
    monthlyPayDay: updated.monthlyPayDay,
    payAmountPerJob: updated.payAmountPerJob,
    staffIdCardUrl: updated.staffIdCardUrl ?? null,
  });
});

router.delete('/:teamId/members/:memberId', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { teamId, memberId } = req.params;
  const { password } = req.body as { password?: string };
  if (!(await verifyAdminPassword(req, password))) {
    const p = password != null ? String(password) : '';
    res.status(p ? 401 : 400).json({ error: p ? '비밀번호가 일치하지 않습니다.' : '비밀번호를 입력해주세요.' });
    return;
  }
  const member = await findTeamMemberInTenantTeam(tenantId, teamId, memberId);
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  await removeTeamMemberStaffIdCardAsset(memberId);
  await prisma.teamMember.delete({ where: { id: memberId } });
  res.json({ ok: true });
});

/** 팀원 휴무 목록 */
router.get('/:teamId/members/:memberId/day-offs', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { teamId, memberId } = req.params;
  const { start, end } = req.query as { start?: string; end?: string };
  const member = await findTeamMemberInTenantTeam(tenantId, teamId, memberId);
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  const now = new Date();
  const startDate =
    start && YMD.test(start) ? new Date(`${start}T12:00:00`) : new Date(now.getFullYear(), now.getMonth(), 1);
  const endDate =
    end && YMD.test(end)
      ? new Date(`${end}T12:00:00`)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const list = await prisma.teamMemberDayOff.findMany({
    where: {
      teamMemberId: memberId,
      date: { gte: startDate, lte: endDate },
    },
    orderBy: { date: 'asc' },
  });
  res.json({ items: list.map((d) => d.date.toISOString().slice(0, 10)) });
});

router.post('/:teamId/members/:memberId/day-offs', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { teamId, memberId } = req.params;
  const { date } = req.body as { date?: string };
  if (!date || !YMD.test(date)) {
    res.status(400).json({ error: '유효한 날짜(yyyy-mm-dd)를 입력해주세요.' });
    return;
  }
  const member = await findTeamMemberInTenantTeam(tenantId, teamId, memberId);
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  const d = new Date(`${date}T12:00:00`);
  await prisma.teamMemberDayOff.upsert({
    where: {
      teamMemberId_date: { teamMemberId: memberId, date: d },
    },
    create: { teamMemberId: memberId, date: d },
    update: {},
  });
  res.json({ ok: true });
});

router.delete('/:teamId/members/:memberId/day-offs', async (req, res) => {
  const tenantId = await requireTenantIdFromAuth(res, (req as unknown as { user: AuthPayload }).user);
  if (!tenantId) return;

  const { teamId, memberId } = req.params;
  const { date } = req.query as { date?: string };
  if (!date || !YMD.test(date)) {
    res.status(400).json({ error: '유효한 날짜(yyyy-mm-dd)를 입력해주세요.' });
    return;
  }
  const member = await findTeamMemberInTenantTeam(tenantId, teamId, memberId);
  if (!member) {
    res.status(404).json({ error: '팀원을 찾을 수 없습니다.' });
    return;
  }
  const d = new Date(`${date}T12:00:00`);
  await prisma.teamMemberDayOff.deleteMany({
    where: { teamMemberId: memberId, date: d },
  });
  res.json({ ok: true });
});

export default router;
