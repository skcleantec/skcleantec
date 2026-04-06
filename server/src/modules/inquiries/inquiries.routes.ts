import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { Prisma } from '@prisma/client';
import type { InquiryStatus } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  authMiddleware,
  adminOrMarketer,
  adminOnly,
  type AuthPayload,
} from '../auth/auth.middleware.js';
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

function canMarketerAssignInquiry(
  inquiry: { createdById: string | null; orderForm: { createdById: string } | null },
  marketerId: string
): boolean {
  if (inquiry.createdById === marketerId) return true;
  if (inquiry.createdById == null && inquiry.orderForm?.createdById === marketerId) return true;
  return false;
}

const router = Router();

const inquiryDetailInclude = {
  createdBy: { select: { id: true, name: true } },
  assignments: {
    orderBy: { sortOrder: 'asc' as const },
    include: { teamLeader: { select: { id: true, name: true } } },
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
    take: 30,
    select: { id: true, createdAt: true, lines: true },
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
  if (user.role === 'MARKETER') {
    andClauses.push(whereInquiryAttributedToMarketer(user.userId));
  } else if (user.role === 'ADMIN' && typeof createdById === 'string' && createdById.trim()) {
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
      include: { teamLeader: { select: { id: true, name: true } } },
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
      select: { id: true, createdAt: true, lines: true },
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

/** 관리자만 — 비밀번호 확인 후 접수 영구 삭제 */
router.delete('/:id', adminOnly, async (req, res) => {
  const { id } = req.params;
  const body = req.body as { password?: string };
  const password = body.password != null ? String(body.password) : '';
  if (!password) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return;
  }

  const user = (req as unknown as { user: AuthPayload }).user;
  const dbUser = await prisma.user.findUnique({ where: { id: user.userId } });
  if (!dbUser) {
    res.status(401).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }
  const valid = await bcrypt.compare(password, dbUser.passwordHash);
  if (!valid) {
    res.status(401).json({ error: '비밀번호가 일치하지 않습니다.' });
    return;
  }

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
    include: { orderForm: { select: { createdById: true } } },
  });
  if (!inquiry) {
    res.status(404).json({ error: '문의를 찾을 수 없습니다.' });
    return;
  }
  if (user.role === 'MARKETER') {
    const mine =
      inquiry.createdById === user.userId ||
      (inquiry.createdById == null && inquiry.orderForm?.createdById === user.userId);
    if (!mine) {
      res.status(403).json({ error: '본인이 접수한 건만 수정할 수 있습니다.' });
      return;
    }
  }

  /** 클라이언트가 teamLeaderIds를 보낸 경우에만 분배(Assignment) 동기화 — 배열이 아닌 형태도 normalize에서 처리 */
  const wantsTeamSync = Object.prototype.hasOwnProperty.call(body, 'teamLeaderIds');
  const teamLeaderIds = normalizeTeamLeaderIds(body.teamLeaderIds);
  if (wantsTeamSync) {
    if (user.role === 'MARKETER' && !canMarketerAssignInquiry(inquiry, user.userId)) {
      res.status(403).json({ error: '본인이 접수한 건만 분배할 수 있습니다.' });
      return;
    }
    if (teamLeaderIds.length > 0 && inquiry.status === 'PENDING') {
      res.status(400).json({
        error:
          '대기 상태(고객 발주서 미제출)인 건은 분배할 수 없습니다. 발주서 제출 후 접수로 바뀌면 분배할 수 있습니다.',
      });
      return;
    }
    if (teamLeaderIds.length > 0) {
      const ok = await prisma.user.count({
        where: { id: { in: teamLeaderIds }, role: 'TEAM_LEADER', isActive: true },
      });
      if (ok !== teamLeaderIds.length) {
        res.status(400).json({ error: '유효한 팀장 계정을 찾을 수 없습니다.' });
        return;
      }
    }
  }

  const data = buildInquiryPatchData(body);
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

  try {
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
    });
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
  res.status(201).json(inquiry);
});

export default router;
