import { Router } from 'express';
import type { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import type { InquiryStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import { authMiddleware, adminOrMarketer, type AuthPayload } from '../auth/auth.middleware.js';
import {
  createdAtRangeFromQuery,
  kstDayRangeYmd,
  kstMonthRangeYm,
} from './inquiryListDateRange.js';
import {
  buildMarketerOverview,
  whereInquiryAttributedToMarketer,
} from './inquiryMarketerOverview.js';
import {
  buildAmountDateChangeLines,
  buildInquiryPatchData,
  projectAfterPatch,
} from './inquiryPatch.helpers.js';
import { isSideCleaningPreferredTime } from '../schedule/scheduleSlot.helpers.js';
import {
  filterExistingProfessionalOptionIds,
  parseProfessionalOptionIdsRaw,
} from '../orderform/specialtyOptions.js';
import { allocateNextInquiryNumber } from './inquiryNumber.js';
import {
  assertCrewCapacityForInquiry,
  preferredDateYmdKst,
} from './crewMemberCapacity.helpers.js';
import { dateToYmdKst, isUserEmployedOnYmd, kstTodayYmd } from '../users/userEmployment.js';
import inquiryCleaningPhotosAdminRoutes from '../inquiry-cleaning-photos/inquiryCleaningPhotos.admin.routes.js';
import { assignmentTeamLeaderSelect } from './assignmentTeamLeaderSelect.js';
import { notifyCsReportNavBadges } from '../realtime/navBadgeNotify.js';
import { notifyInquiryCelebrate } from '../realtime/inquiryCelebrateNotify.js';

function normalizeTeamLeaderIds(raw: unknown): string[] {
  if (raw == null) return [];
  if (typeof raw === 'string') {
    const id = raw.trim();
    return id ? [id] : [];
  }
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of raw) {
    const id = typeof x === 'string' ? x.trim() : String(x ?? '').trim();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}

/** 관리자 본인 비밀번호 확인 — 실패 시 res 전송 후 false */
async function verifyAdminPasswordForRequest(
  req: Request,
  res: Response,
  passwordRaw: unknown
): Promise<boolean> {
  const password = passwordRaw != null ? String(passwordRaw) : '';
  if (!password) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return false;
  }
  const user = (req as unknown as { user: AuthPayload }).user;
  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!dbUser) {
    res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    return false;
  }
  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) {
    res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    return false;
  }
  return true;
}

const router = Router();

const inquiryDetailInclude = {
  createdBy: { select: { id: true, name: true } },
  assignments: {
    orderBy: { sortOrder: 'asc' as const },
    include: { teamLeader: { select: assignmentTeamLeaderSelect } },
  },
  orderForm: {
    select: {
      id: true,
      createdById: true,
      totalAmount: true,
      depositAmount: true,
      balanceAmount: true,
      createdBy: { select: { id: true, name: true } },
    },
  },
  changeLogs: {
    orderBy: { createdAt: 'desc' as const },
    take: 30,
    select: {
      id: true,
      createdAt: true,
      lines: true,
      actorId: true,
      actor: { select: { id: true, name: true } },
    },
  },
};

router.use(authMiddleware);
router.use(adminOrMarketer);

/** 마케터별 이번 달·오늘 접수 건수 (목록 필터와 무관, 접수일 KST) */
router.get('/marketer-overview', async (_req, res) => {
  try {
    const data = await buildMarketerOverview();
    res.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('marketer-overview error:', msg, err);
    const hint =
      process.env.NODE_ENV !== 'production'
        ? `${msg}`
        : '마케터별 집계를 불러올 수 없습니다.';
    res.status(500).json({ error: hint });
  }
});

router.get('/', async (req, res) => {
  const user = (req as unknown as { user: AuthPayload }).user;
  const {
    status,
    limit = '200',
    offset = '0',
    search,
    datePreset,
    month,
    day,
    createdById,
    teamLeaderId,
    scheduleMonth,
    scheduleDay,
  } = req.query;
  const range = createdAtRangeFromQuery({
    datePreset: typeof datePreset === 'string' ? datePreset : undefined,
    month: typeof month === 'string' ? month : undefined,
    day: typeof day === 'string' ? day : undefined,
  });

  const andClauses: Prisma.InquiryWhereInput[] = [];
  if (range) {
    andClauses.push({ createdAt: { gte: range.gte, lte: range.lte } });
  }
  if (status && typeof status === 'string') {
    andClauses.push({ status: status as InquiryStatus });
  }
  if (search && typeof search === 'string' && search.trim()) {
    const s = search.trim();
    andClauses.push({
      OR: [
        { customerName: { contains: s } },
        { customerPhone: { contains: s } },
        { inquiryNumber: { contains: s } },
      ],
    });
  }
  /** 마케터: 본인 접수(또는 구 데이터 발주서 작성자)만. 관리자: 선택 시 해당 사용자 기준 또는 미지정 */
  const CREATED_BY_FILTER_UNASSIGNED = '__unassigned__';
  if (
    (user.role === 'ADMIN' || user.role === 'MARKETER') &&
    typeof createdById === 'string' &&
    createdById.trim()
  ) {
    const cid = createdById.trim();
    if (cid === CREATED_BY_FILTER_UNASSIGNED) {
      /** 접수 등록자 없음·발주서 미연결(화면상 접수자 '-') */
      andClauses.push({
        createdById: null,
        orderFormId: null,
      });
    } else {
      andClauses.push(whereInquiryAttributedToMarketer(cid));
    }
  }

  const TEAM_LEADER_FILTER_UNASSIGNED = '__unassigned__';
  if (typeof teamLeaderId === 'string' && teamLeaderId.trim()) {
    const tid = teamLeaderId.trim();
    if (tid === TEAM_LEADER_FILTER_UNASSIGNED) {
      andClauses.push({ assignments: { none: {} } });
    } else {
      andClauses.push({ assignments: { some: { teamLeaderId: tid } } });
    }
  }

  /** 예약일(희망일 preferredDate) — KST. scheduleDay가 있으면 월보다 우선 */
  if (typeof scheduleDay === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(scheduleDay.trim())) {
    const r = kstDayRangeYmd(scheduleDay.trim());
    if (r) {
      andClauses.push({ preferredDate: { not: null } });
      andClauses.push({ preferredDate: { gte: r.gte, lte: r.lte } });
    }
  } else if (typeof scheduleMonth === 'string' && /^\d{4}-\d{2}$/.test(scheduleMonth.trim())) {
    const r = kstMonthRangeYm(scheduleMonth.trim());
    if (r) {
      andClauses.push({ preferredDate: { not: null } });
      andClauses.push({ preferredDate: { gte: r.gte, lte: r.lte } });
    }
  }

  const where: Prisma.InquiryWhereInput = andClauses.length > 0 ? { AND: andClauses } : {};
  const listInclude = {
    createdBy: { select: { id: true, name: true } },
    assignments: {
      orderBy: { sortOrder: 'asc' as const },
      include: { teamLeader: { select: assignmentTeamLeaderSelect } },
    },
    orderForm: {
      select: {
        id: true,
        totalAmount: true,
        depositAmount: true,
        balanceAmount: true,
        createdBy: { select: { id: true, name: true } },
      },
    },
    changeLogs: {
      orderBy: { createdAt: 'desc' as const },
      take: 25,
      select: {
        id: true,
        createdAt: true,
        lines: true,
        actorId: true,
        actor: { select: { id: true, name: true } },
      },
    },
  } as const;

  const [items, total] = await Promise.all([
    prisma.inquiry.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string, 10),
      skip: parseInt(offset as string, 10),
      include: listInclude,
    }),
    prisma.inquiry.count({ where }),
  ]);
  res.json({ items, total });
});

/** 관리자만 — 접수일(createdAt) KST 하루 단위 영구 삭제 (배정·이력·현장사진 연쇄 삭제) */
router.post('/admin/bulk-delete-by-day', adminOrMarketer, async (req, res) => {
  const body = req.body as { day?: string; password?: unknown };
  const day = typeof body.day === 'string' ? body.day.trim() : '';
  const range = kstDayRangeYmd(day);
  if (!range) {
    res.status(400).json({ error: '날짜는 YYYY-MM-DD 형식이어야 합니다.' });
    return;
  }
  if (!(await verifyAdminPasswordForRequest(req, res, body.password))) return;
  const del = await prisma.inquiry.deleteMany({
    where: { createdAt: { gte: range.gte, lte: range.lte } },
  });
  res.json({ deleted: del.count });
});

/** 관리자만 — 접수일(createdAt) KST 해당 월 영구 삭제 */
router.post('/admin/bulk-delete-by-month', adminOrMarketer, async (req, res) => {
  const body = req.body as { month?: string; password?: unknown };
  const month = typeof body.month === 'string' ? body.month.trim() : '';
  const range = kstMonthRangeYm(month);
  if (!range) {
    res.status(400).json({ error: '월은 YYYY-MM 형식이어야 합니다.' });
    return;
  }
  if (!(await verifyAdminPasswordForRequest(req, res, body.password))) return;
  const del = await prisma.inquiry.deleteMany({
    where: { createdAt: { gte: range.gte, lte: range.lte } },
  });
  res.json({ deleted: del.count });
});

/** 단일 접수 상세 (목록 항목과 동일 include — 딥링크·C/S 연결 등) */
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  const inquiry = await prisma.inquiry.findUnique({
    where: { id },
    include: inquiryDetailInclude,
  });
  if (!inquiry) {
    res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
    return;
  }
  res.json(inquiry);
});

/** 접수별 현장 청소 전·후 사진 (Cloudinary) — 목록·업로드·삭제 */
router.use('/:inquiryId/cleaning-photos', inquiryCleaningPhotosAdminRoutes);

/** 관리자만 — 비밀번호 확인 후 접수 영구 삭제 */
router.delete('/:id', adminOrMarketer, async (req, res) => {
  const { id } = req.params;
  const body = req.body as { password?: string };
  if (!(await verifyAdminPasswordForRequest(req, res, body.password))) return;

  const existing = await prisma.inquiry.findUnique({ where: { id } });
  if (!existing) {
    res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
    return;
  }

  await prisma.inquiry.delete({ where: { id } });
  res.json({ ok: true });
});

router.patch('/:id', async (req, res) => {
  const { id } = req.params;
  const body = req.body as Record<string, unknown>;
  const user = (req as unknown as { user: AuthPayload }).user;
  const inquiry = await prisma.inquiry.findUnique({
    where: { id },
    include: {
      orderForm: { select: { createdById: true } },
      assignments: {
        orderBy: { sortOrder: 'asc' },
        include: {
          teamLeader: {
            select: {
              id: true,
              name: true,
              role: true,
              externalCompany: { select: { name: true } },
            },
          },
        },
      },
    },
  });
  if (!inquiry) {
    res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
    return;
  }

  /** 클라이언트가 teamLeaderIds를 보낸 경우에만 분배(Assignment) 동기화 — 배열이 아닌 형태도 normalize에서 처리 */
  const wantsTeamSync = Object.prototype.hasOwnProperty.call(body, 'teamLeaderIds');
  const teamLeaderIds = normalizeTeamLeaderIds(body.teamLeaderIds);

  const data = buildInquiryPatchData(body);

  let assigneesForLog: Array<{
    id: string;
    role: string;
    name: string;
    externalCompanyId: string | null;
    externalCompany: { name: string } | null;
  }> = [];
  if (wantsTeamSync) {
    if (teamLeaderIds.length > 0 && inquiry.status === 'PENDING') {
      res.status(400).json({
        error:
          '대기 상태(고객 발주서 미제출)인 건은 분배할 수 없습니다. 발주서 제출 후 접수로 바뀌면 분배할 수 있습니다.',
      });
      return;
    }
    if (teamLeaderIds.length > 0) {
      const assignees = await prisma.user.findMany({
        where: {
          id: { in: teamLeaderIds },
          isActive: true,
          role: { in: ['TEAM_LEADER', 'EXTERNAL_PARTNER'] },
        },
        select: {
          id: true,
          role: true,
          name: true,
          hireDate: true,
          resignationDate: true,
          externalCompanyId: true,
          externalCompany: { select: { name: true } },
        },
      });
      if (assignees.length !== teamLeaderIds.length) {
        res.status(400).json({ error: '유효한 팀장 또는 타업체 계정을 찾을 수 없습니다.' });
        return;
      }
      for (const a of assignees) {
        if (a.role === 'EXTERNAL_PARTNER' && !a.externalCompanyId) {
          res.status(400).json({ error: '타업체 계정에 소속 업체가 없습니다. 관리자에게 문의하세요.' });
          return;
        }
      }
      const mergedPd =
        data.preferredDate !== undefined
          ? (data.preferredDate as Date | null)
          : inquiry.preferredDate;
      const assignYmd = mergedPd ? dateToYmdKst(new Date(mergedPd)) : kstTodayYmd();
      for (const l of assignees) {
        if (l.role !== 'TEAM_LEADER') continue;
        if (!isUserEmployedOnYmd(l.hireDate, l.resignationDate, assignYmd)) {
          res.status(400).json({
            error: '선택한 팀장 중 해당 예약일에 배정할 수 없는 계정이 있습니다.',
          });
          return;
        }
      }
      assigneesForLog = assignees;
    }
  }

  if (body.professionalOptionIds !== undefined) {
    const raw = parseProfessionalOptionIdsRaw(body.professionalOptionIds);
    data.professionalOptionIds = await filterExistingProfessionalOptionIds(prisma, raw);
  }
  if (data.crewMemberCount !== undefined && data.crewMemberCount !== null) {
    const n = Number(data.crewMemberCount);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      res.status(400).json({ error: '팀원 인원은 0~100 사이로 입력해주세요.' });
      return;
    }
  }

  const mergedPreferredDate =
    data.preferredDate !== undefined
      ? (data.preferredDate as Date | null)
      : inquiry.preferredDate;
  const mergedCrew =
    data.crewMemberCount !== undefined
      ? (data.crewMemberCount as number | null)
      : inquiry.crewMemberCount;
  const mergedStatus = data.status !== undefined ? (data.status as InquiryStatus) : inquiry.status;
  const mergedCustomerName =
    data.customerName !== undefined ? String(data.customerName ?? '').trim() : inquiry.customerName;
  const mergedCustomerPhone =
    data.customerPhone !== undefined ? String(data.customerPhone ?? '').trim() : inquiry.customerPhone;
  const mergedClaimMemo =
    data.claimMemo !== undefined ? String(data.claimMemo ?? '').trim() : String(inquiry.claimMemo ?? '').trim();

  /** 팀원 용량 검사: 예약일·팀원 수가 실제로 바뀔 때만 (같은 날 팀장만 수정하는 PATCH는 제외) */
  const preferredDateKstChanged =
    data.preferredDate !== undefined &&
    preferredDateYmdKst(mergedPreferredDate) !== preferredDateYmdKst(inquiry.preferredDate);
  const crewMemberCountChanged =
    data.crewMemberCount !== undefined &&
    (mergedCrew ?? null) !== (inquiry.crewMemberCount ?? null);

  if (mergedStatus !== 'CANCELLED' && mergedPreferredDate) {
    const capacityRelevant =
      preferredDateKstChanged ||
      crewMemberCountChanged ||
      (data.status !== undefined && inquiry.status === 'CANCELLED');
    if (capacityRelevant) {
      const cap = await assertCrewCapacityForInquiry({
        prisma,
        preferredDate: mergedPreferredDate,
        crewMemberCount: mergedCrew ?? null,
        excludeInquiryId: id,
        assigneeUserIdsPreview: wantsTeamSync ? teamLeaderIds : undefined,
      });
      if (!cap.ok) {
        res.status(400).json({ error: cap.error });
        return;
      }
    }
  }

  const mergedTime =
    data.preferredTime !== undefined
      ? String(data.preferredTime)
      : String(inquiry.preferredTime ?? '');
  if (!isSideCleaningPreferredTime(mergedTime)) {
    data.betweenScheduleSlot = null;
  }
  if (data.betweenScheduleSlot != null && !isSideCleaningPreferredTime(mergedTime)) {
    res.status(400).json({ error: '사이청소 접수만 오전/오후 일정을 확정할 수 있습니다.' });
    return;
  }

  if (wantsTeamSync && teamLeaderIds.length > 0 && data.status === undefined) {
    data.status = 'ASSIGNED';
  }

  if (Object.keys(data).length === 0 && !wantsTeamSync) {
    const unchanged = await prisma.inquiry.findUnique({
      where: { id },
      include: inquiryDetailInclude,
    });
    res.json(unchanged);
    return;
  }

  const beforeSnap = {
    preferredDate: inquiry.preferredDate,
    serviceTotalAmount: inquiry.serviceTotalAmount,
    serviceDepositAmount: inquiry.serviceDepositAmount,
    serviceBalanceAmount: inquiry.serviceBalanceAmount,
  };
  const afterSnap = projectAfterPatch(inquiry, data);
  const lines = buildAmountDateChangeLines(beforeSnap, afterSnap);
  const fmtBetween = (v: string | null | undefined) =>
    v == null || v === '' ? '미확정' : String(v);
  let mergedBetween =
    data.betweenScheduleSlot !== undefined
      ? (data.betweenScheduleSlot as string | null)
      : inquiry.betweenScheduleSlot;
  if (!isSideCleaningPreferredTime(mergedTime)) {
    mergedBetween = null;
  }
  if (fmtBetween(inquiry.betweenScheduleSlot) !== fmtBetween(mergedBetween)) {
    lines.push(`사이청소 일정 확정: ${fmtBetween(inquiry.betweenScheduleSlot)} → ${fmtBetween(mergedBetween)}`);
  }
  const fmtText = (v: unknown) => (v == null || v === '' ? '(없음)' : String(v));
  const fmtNum = (v: unknown) => (v == null || v === '' ? '(없음)' : String(v));
  const fmtStatus = (v: unknown) => {
    const m: Record<string, string> = {
      PENDING: '대기',
      RECEIVED: '접수',
      ASSIGNED: '분배완료',
      IN_PROGRESS: '진행중',
      COMPLETED: '완료',
      CANCELLED: '취소',
      CS_PROCESSING: 'C/S 처리중',
    };
    if (v == null || v === '') return '(없음)';
    const s = String(v);
    return m[s] ?? s;
  };
  const fmtDate = (v: unknown) => {
    if (!v) return '(없음)';
    const d = v instanceof Date ? v : new Date(String(v));
    if (Number.isNaN(d.getTime())) return '(없음)';
    return d.toISOString().slice(0, 10);
  };
  const pushIfChanged = (label: string, before: unknown, after: unknown, fmt = fmtText) => {
    if (before === after) return;
    if (String(before ?? '') === String(after ?? '')) return;
    lines.push(`${label}: ${fmt(before)} → ${fmt(after)}`);
  };

  if (data.customerName !== undefined) pushIfChanged('고객명', inquiry.customerName, data.customerName);
  if (data.customerPhone !== undefined) pushIfChanged('연락처', inquiry.customerPhone, data.customerPhone);
  if (data.customerPhone2 !== undefined) pushIfChanged('보조 연락처', inquiry.customerPhone2, data.customerPhone2);
  if (data.address !== undefined) pushIfChanged('주소', inquiry.address, data.address);
  if (data.addressDetail !== undefined) pushIfChanged('상세주소', inquiry.addressDetail, data.addressDetail);
  if (data.areaPyeong !== undefined) pushIfChanged('평수', inquiry.areaPyeong, data.areaPyeong, fmtNum);
  if (data.areaBasis !== undefined) pushIfChanged('평수 기준', inquiry.areaBasis, data.areaBasis);
  if (data.propertyType !== undefined) pushIfChanged('건물 유형', inquiry.propertyType, data.propertyType);
  if (data.roomCount !== undefined) pushIfChanged('방', inquiry.roomCount, data.roomCount, fmtNum);
  if (data.bathroomCount !== undefined) pushIfChanged('화장실', inquiry.bathroomCount, data.bathroomCount, fmtNum);
  if (data.balconyCount !== undefined) pushIfChanged('베란다', inquiry.balconyCount, data.balconyCount, fmtNum);
  if (data.kitchenCount !== undefined) pushIfChanged('주방', inquiry.kitchenCount, data.kitchenCount, fmtNum);
  if (data.preferredTime !== undefined) pushIfChanged('희망 시간대', inquiry.preferredTime, data.preferredTime);
  if (data.preferredTimeDetail !== undefined)
    pushIfChanged('희망 시간 상세', inquiry.preferredTimeDetail, data.preferredTimeDetail);
  if (data.buildingType !== undefined) pushIfChanged('건물 구분', inquiry.buildingType, data.buildingType);
  if (data.moveInDate !== undefined) pushIfChanged('이사일', inquiry.moveInDate, data.moveInDate, fmtDate);
  if (data.specialNotes !== undefined) pushIfChanged('특이사항', inquiry.specialNotes, data.specialNotes);
  if (data.memo !== undefined) pushIfChanged('메모', inquiry.memo, data.memo);
  if (data.scheduleMemo !== undefined) pushIfChanged('일정 메모', inquiry.scheduleMemo, data.scheduleMemo);
  if (data.claimMemo !== undefined) pushIfChanged('클레임 메모', inquiry.claimMemo, data.claimMemo);
  if (data.status !== undefined) pushIfChanged('상태', inquiry.status, data.status, fmtStatus);
  if (data.crewMemberCount !== undefined)
    pushIfChanged('팀원 인원', inquiry.crewMemberCount, data.crewMemberCount, fmtNum);
  if (data.crewMemberNote !== undefined) pushIfChanged('팀원 메모', inquiry.crewMemberNote, data.crewMemberNote);
  if (data.externalTransferFee !== undefined)
    pushIfChanged('타업체 넘김 수수료', inquiry.externalTransferFee, data.externalTransferFee, fmtNum);
  if (data.professionalOptionIds !== undefined) {
    const before = Array.isArray(inquiry.professionalOptionIds) ? inquiry.professionalOptionIds : [];
    const after = Array.isArray(data.professionalOptionIds) ? data.professionalOptionIds : [];
    const beforeTxt = before.length > 0 ? before.join(', ') : '(없음)';
    const afterTxt = after.length > 0 ? after.join(', ') : '(없음)';
    if (beforeTxt !== afterTxt) lines.push(`전문 작업 옵션: ${beforeTxt} → ${afterTxt}`);
  }
  if (wantsTeamSync) {
    const toLeaderLabel = (u: { name: string; role: string; externalCompany: { name: string } | null }) =>
      u.role === 'EXTERNAL_PARTNER'
        ? `[타업체] ${u.externalCompany?.name ?? u.name}`
        : u.name;
    const beforeTeam = inquiry.assignments.map((a) => toLeaderLabel(a.teamLeader));
    const assigneeMap = new Map(assigneesForLog.map((u) => [u.id, u] as const));
    const afterTeam = teamLeaderIds
      .map((id) => assigneeMap.get(id))
      .filter((u): u is NonNullable<typeof u> => Boolean(u))
      .map((u) => toLeaderLabel(u));
    const beforeTxt = beforeTeam.length > 0 ? beforeTeam.join(' · ') : '미배정';
    const afterTxt = afterTeam.length > 0 ? afterTeam.join(' · ') : '미배정';
    if (beforeTxt !== afterTxt) lines.push(`팀장 배정: ${beforeTxt} → ${afterTxt}`);
  }

  try {
    let createdCsReport = false;
    await prisma.$transaction(async (tx) => {
      if (Object.keys(data).length > 0) {
        await tx.inquiry.update({ where: { id }, data });
      }
      if (wantsTeamSync) {
        await tx.assignment.deleteMany({ where: { inquiryId: id } });
        if (teamLeaderIds.length > 0) {
          await tx.assignment.createMany({
            data: teamLeaderIds.map((teamLeaderId, sortOrder) => ({
              inquiryId: id,
              teamLeaderId,
              assignedById: user.userId,
              sortOrder,
            })),
          });
        }
      }
      if (lines.length > 0) {
        await tx.inquiryChangeLog.create({
          data: {
            inquiryId: id,
            actorId: user?.userId ?? null,
            lines,
          },
        });
      }

      /**
       * 접수 상태가 C/S 처리중이면 C/S 관리에 반드시 노출되도록 보장한다.
       * (직접 클레임 등록 시 상태만 바뀌고 C/S 목록 누락되는 케이스 방지)
       */
      if (mergedStatus === 'CS_PROCESSING') {
        const openCsCount = await tx.csReport.count({
          where: {
            inquiryId: id,
            status: { not: 'DONE' },
          },
        });
        if (openCsCount === 0) {
          await tx.csReport.create({
            data: {
              inquiryId: id,
              customerName: mergedCustomerName || inquiry.customerName,
              customerPhone: mergedCustomerPhone || inquiry.customerPhone,
              content: mergedClaimMemo || '접수 목록에서 C/S 처리중으로 전환된 건입니다.',
              imageUrls: [],
              status: 'RECEIVED',
            },
          });
          createdCsReport = true;
        }
      }
    });
    if (createdCsReport) {
      void notifyCsReportNavBadges(id);
    }
  } catch (e) {
    console.error('PATCH inquiry transaction:', e);
    res.status(500).json({ error: '저장 중 오류가 발생했습니다.' });
    return;
  }

  const updated = await prisma.inquiry.findUnique({
    where: { id },
    include: inquiryDetailInclude,
  });
  res.json(updated);
});

const CREATE_STATUSES: InquiryStatus[] = [
  'PENDING',
  'RECEIVED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'CANCELLED',
  'CS_PROCESSING',
];

router.post('/', async (req, res) => {
  const body = req.body as Record<string, unknown>;
  const user = (req as unknown as { user: AuthPayload }).user;
  const rawStatus = body.status != null ? String(body.status) : '';
  const status: InquiryStatus =
    rawStatus && CREATE_STATUSES.includes(rawStatus as InquiryStatus)
      ? (rawStatus as InquiryStatus)
      : 'RECEIVED';

  let crewMemberCount: number | null = null;
  if (body.crewMemberCount !== undefined && body.crewMemberCount !== null && body.crewMemberCount !== '') {
    const n = Number(body.crewMemberCount);
    if (!Number.isFinite(n) || n < 0 || n > 100) {
      res.status(400).json({ error: '팀원 인원은 0~100 사이로 입력해주세요.' });
      return;
    }
    crewMemberCount = Math.floor(n);
  }

  const preferredDate = body.preferredDate ? new Date(body.preferredDate as string) : null;

  if (status !== 'CANCELLED' && preferredDate) {
    const cap = await assertCrewCapacityForInquiry({
      prisma,
      preferredDate,
      crewMemberCount,
      excludeInquiryId: undefined,
    });
    if (!cap.ok) {
      res.status(400).json({ error: cap.error });
      return;
    }
  }

  const inquiry = await prisma.$transaction(async (tx) => {
    const inquiryNumber = await allocateNextInquiryNumber(tx);
    return tx.inquiry.create({
      data: {
        inquiryNumber,
        createdById: user?.userId ?? null,
        customerName: String(body.customerName ?? ''),
        customerPhone: String(body.customerPhone ?? ''),
        customerPhone2: body.customerPhone2 ? String(body.customerPhone2) : null,
        address: String(body.address ?? ''),
        addressDetail: body.addressDetail ? String(body.addressDetail) : null,
        areaPyeong: body.areaPyeong != null ? Number(body.areaPyeong) : null,
        areaBasis: body.areaBasis ? String(body.areaBasis) : null,
        propertyType: body.propertyType ? String(body.propertyType) : null,
        roomCount: body.roomCount != null ? Number(body.roomCount) : null,
        bathroomCount: body.bathroomCount != null ? Number(body.bathroomCount) : null,
        balconyCount: body.balconyCount != null ? Number(body.balconyCount) : null,
        preferredDate,
        preferredTime: body.preferredTime ? String(body.preferredTime) : null,
        preferredTimeDetail: body.preferredTimeDetail ? String(body.preferredTimeDetail) : null,
        callAttempt: body.callAttempt != null ? Number(body.callAttempt) : null,
        memo: body.memo ? String(body.memo) : null,
        source: body.source ? String(body.source) : '전화',
        status,
        crewMemberCount,
      },
    });
  });
  void notifyInquiryCelebrate({
    createdById: inquiry.createdById,
    customerName: inquiry.customerName,
    inquiryNumber: inquiry.inquiryNumber,
    source: inquiry.source,
  });
  res.status(201).json(inquiry);
});

export default router;
