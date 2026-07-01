import { Router } from 'express';
import bcrypt from 'bcryptjs';
import type { InquiryStatus, Prisma } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  authMiddleware,
  type AuthPayload,
  superAdminOnly,
} from '../auth/auth.middleware.js';
import { requireStaffPermission } from '../auth/marketerPermission.middleware.js';
import { isTenantOwnerAdmin } from '../auth/tenantOwner.js';
import {
  inclusiveDayCount,
  parseRange,
  resolveMarketerScope,
  loadMarketerUsers,
  sumSpendFromSessions,
} from './advertising.helpers.js';
import {
  normalizeAdSessionEndLines,
  type NormalizedAdSpendRow,
  type RawAdSessionEndLine,
} from './advertising.sessionEndNormalize.js';
import {
  applyResolvedBookingDenominator,
  countBookingDenominatorAuto,
  sumReservationCountsFromWorkSessionsInPeriod,
} from './advertising.bookingDenominator.js';
import { advertisingDailySettlementForMonthKey } from './advertising.dailySettlement.js';
import { requireFeature } from '../tenants/requireTenantFeature.js';
import { getTenantIdFromAuth } from '../tenants/tenant.middleware.js';

const router = Router();

/** 모든 광고비 API — mod_advertising 활성 테넌트만 */
router.use(authMiddleware, requireFeature('mod_advertising'));

/**
 * 광고비 분석 ROAS·건당 비용 분모 — **고객 발주서 제출(submittedAt) 확정 건**.
 * 미제출 발급·접수 취소·삭제는 분모 제외(별도 집계).
 */
const ADVERTISING_ANALYTICS_RESERVATION_STATUSES: InquiryStatus[] = [
  'RECEIVED',
  'ASSIGNED',
  'IN_PROGRESS',
  'COMPLETED',
  'ON_HOLD',
  'CS_PROCESSING',
];

function authUser(req: unknown): AuthPayload {
  return (req as { user: AuthPayload }).user;
}

function requireTenantFromReq(req: unknown, res: import('express').Response): string | null {
  const tenantId = getTenantIdFromAuth(authUser(req));
  if (!tenantId) {
    res.status(403).json({ error: '테넌트 업무 세션이 필요합니다.' });
    return null;
  }
  return tenantId;
}

/** 활성 채널 목록 (종료 시 금액 입력용). ?all=1 이면 최고 관리자만 비활성 포함. 과목(lineItems) 포함 */
router.get('/channels', authMiddleware, requireStaffPermission('ads.sessions', 'ads.analytics', 'ads.settings'), async (req, res) => {
  const user = authUser(req);
  const tenantId = requireTenantFromReq(req, res);
  if (!tenantId) return;
  const all = req.query.all === '1' || req.query.all === 'true';
  const includeInactive = all && isTenantOwnerAdmin(user);
  const channels = await prisma.adChannel.findMany({
    where: {
      tenantId,
      ...(includeInactive ? {} : { isActive: true }),
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { lineItems: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
  });
  res.json({ items: channels });
});

/** 관리자 전용: 모든 채널·과목 설정 조회 (비활성 포함) */
router.get('/settlement-config', authMiddleware, requireStaffPermission('ads.settings'), async (req, res) => {
  const tenantId = requireTenantFromReq(req, res);
  if (!tenantId) return;
  const items = await prisma.adChannel.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
    include: { lineItems: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
  });
  res.json({ items });
});

router.patch('/channels/:id/settlement-mode', authMiddleware, requireStaffPermission('ads.settings'), async (req, res) => {
  const tenantId = requireTenantFromReq(req, res);
  if (!tenantId) return;
  const { id } = req.params;
  const mode = (req.body as { settlementMode?: string }).settlementMode;
  if (mode !== 'DIRECT_AMOUNT' && mode !== 'COUNT_LINES') {
    res.status(400).json({ error: 'settlementMode는 DIRECT_AMOUNT 또는 COUNT_LINES 여야 합니다.' });
    return;
  }
  /** 과목 0건이어도 건수 방식으로 전환 허용 → 설정 화면에서 과목 추가 후 사용 */
  try {
    const owned = await prisma.adChannel.findFirst({ where: { id, tenantId } });
    if (!owned) {
      res.status(404).json({ error: '채널을 찾을 수 없습니다.' });
      return;
    }
    const row = await prisma.adChannel.update({
      where: { id },
      data: { settlementMode: mode },
      include: { lineItems: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
    });
    res.json(row);
  } catch {
    res.status(404).json({ error: '채널을 찾을 수 없습니다.' });
  }
});

router.post('/channels/:channelId/line-items', authMiddleware, requireStaffPermission('ads.settings'), async (req, res) => {
  const tenantId = requireTenantFromReq(req, res);
  if (!tenantId) return;
  const { channelId } = req.params;
  const body = req.body as {
    label?: string;
    unitAmountWon?: number;
    countsForSpend?: boolean;
    sortOrder?: number;
  };
  const label = String(body.label ?? '').trim();
  if (!label || label.length > 128) {
    res.status(400).json({ error: '과목 이름을 입력해 주세요. (128자 이내)' });
    return;
  }
  const unit = Math.round(Number(body.unitAmountWon));
  if (!Number.isFinite(unit) || unit < 0) {
    res.status(400).json({ error: '건당 금액은 0 이상 정수로 입력해 주세요.' });
    return;
  }
  const ch = await prisma.adChannel.findFirst({ where: { id: channelId, tenantId } });
  if (!ch) {
    res.status(404).json({ error: '채널을 찾을 수 없습니다.' });
    return;
  }
  const countsForSpend = body.countsForSpend != null ? Boolean(body.countsForSpend) : true;
  /** 합산 제외 과목 건수 = 종료 화면 평균 분모(자동). 별도 설정 불필요 */
  const useAsAvgDenominator = !countsForSpend;
  const sortOrder =
    typeof body.sortOrder === 'number' && Number.isFinite(body.sortOrder) ? Math.round(body.sortOrder) : 0;

  const row = await prisma.adChannelLineItem.create({
    data: {
      channelId,
      label,
      unitAmountWon: unit,
      countsForSpend,
      useAsAvgDenominator,
      sortOrder,
    },
  });
  res.json(row);
});

router.patch('/line-items/:lineItemId', authMiddleware, requireStaffPermission('ads.settings'), async (req, res) => {
  const tenantId = requireTenantFromReq(req, res);
  if (!tenantId) return;
  const { lineItemId } = req.params;
  const body = req.body as {
    label?: string;
    unitAmountWon?: number;
    countsForSpend?: boolean;
    sortOrder?: number;
  };
  const existingFull = await prisma.adChannelLineItem.findFirst({
    where: { id: lineItemId, channel: { tenantId } },
  });
  if (!existingFull) {
    res.status(404).json({ error: '과목을 찾을 수 없습니다.' });
    return;
  }

  let labelNext: string | undefined;
  if (body.label != null) {
    const label = String(body.label).trim();
    if (!label || label.length > 128) {
      res.status(400).json({ error: '과목 이름은 128자 이내로 입력해 주세요.' });
      return;
    }
    labelNext = label;
  }
  if (body.unitAmountWon != null) {
    const unit = Math.round(Number(body.unitAmountWon));
    if (!Number.isFinite(unit) || unit < 0) {
      res.status(400).json({ error: '건당 금액은 0 이상 정수입니다.' });
      return;
    }
  }

  const nextCountsForSpend =
    body.countsForSpend != null ? Boolean(body.countsForSpend) : existingFull.countsForSpend;

  const row = await prisma.adChannelLineItem.update({
    where: { id: lineItemId },
    data: {
      ...(labelNext != null ? { label: labelNext } : {}),
      ...(body.unitAmountWon != null
        ? { unitAmountWon: Math.round(Number(body.unitAmountWon)) }
        : {}),
      ...(body.countsForSpend != null ? { countsForSpend: nextCountsForSpend } : {}),
      useAsAvgDenominator: !nextCountsForSpend,
      ...(body.sortOrder != null && Number.isFinite(body.sortOrder)
        ? { sortOrder: Math.round(body.sortOrder) }
        : {}),
    },
  });
  res.json(row);
});

router.delete('/line-items/:lineItemId', authMiddleware, requireStaffPermission('ads.settings'), async (req, res) => {
  const tenantId = requireTenantFromReq(req, res);
  if (!tenantId) return;
  const { lineItemId } = req.params;
  const owned = await prisma.adChannelLineItem.findFirst({
    where: { id: lineItemId, channel: { tenantId } },
    select: { id: true },
  });
  if (!owned) {
    res.status(404).json({ error: '과목을 찾을 수 없습니다.' });
    return;
  }
  try {
    await prisma.adChannelLineItem.delete({ where: { id: lineItemId } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: '과목을 찾을 수 없습니다.' });
  }
});

router.post('/channels', authMiddleware, requireStaffPermission('ads.settings'), async (req, res) => {
  const tenantId = requireTenantFromReq(req, res);
  if (!tenantId) return;
  const { name, sortOrder } = req.body as { name?: string; sortOrder?: number };
  const n = String(name ?? '').trim();
  if (!n) {
    res.status(400).json({ error: '채널 이름을 입력해주세요.' });
    return;
  }
  const row = await prisma.adChannel.create({
    data: {
      tenantId,
      name: n,
      sortOrder: typeof sortOrder === 'number' && Number.isFinite(sortOrder) ? sortOrder : 0,
    },
  });
  res.json(row);
});

/** 채널 표시 순서 일괄 저장 (배열 순서 = 위에서 아래) */
router.put('/channels/reorder', authMiddleware, superAdminOnly, async (req, res) => {
  const tenantId = requireTenantFromReq(req, res);
  if (!tenantId) return;
  const body = req.body as { orderedIds?: string[] };
  const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds.filter((x) => typeof x === 'string' && x.trim()) : [];
  if (orderedIds.length === 0) {
    res.status(400).json({ error: '순서(채널 id 배열)가 필요합니다.' });
    return;
  }
  const unique = new Set(orderedIds);
  if (unique.size !== orderedIds.length) {
    res.status(400).json({ error: '중복된 채널이 있습니다.' });
    return;
  }
  const existing = await prisma.adChannel.findMany({
    where: { tenantId, id: { in: orderedIds } },
    select: { id: true },
  });
  if (existing.length !== orderedIds.length) {
    res.status(400).json({ error: '존재하지 않는 채널이 포함되어 있습니다.' });
    return;
  }
  await prisma.$transaction(
    orderedIds.map((id, index) =>
      prisma.adChannel.update({ where: { id }, data: { sortOrder: index } })
    )
  );
  res.json({ ok: true });
});

/** 광고비 입력 이력이 없는 채널만 삭제. 본인 비밀번호 확인 필수 */
router.delete('/channels/:id', authMiddleware, superAdminOnly, async (req, res) => {
  const tenantId = requireTenantFromReq(req, res);
  if (!tenantId) return;
  const { id } = req.params;
  const body = req.body as { password?: string };
  const password = body.password != null ? String(body.password) : '';
  if (!password) {
    res.status(400).json({ error: '비밀번호를 입력해주세요.' });
    return;
  }

  const user = authUser(req);
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

  const owned = await prisma.adChannel.findFirst({ where: { id, tenantId } });
  if (!owned) {
    res.status(404).json({ error: '채널을 찾을 수 없습니다.' });
    return;
  }

  const lineCount = await prisma.adSpendLine.count({ where: { channelId: id } });
  if (lineCount > 0) {
    res.status(400).json({
      error: '이미 광고비 입력 이력이 있는 채널은 삭제할 수 없습니다. 비활성화를 이용해 주세요.',
    });
    return;
  }

  try {
    await prisma.adChannel.delete({ where: { id } });
    res.json({ ok: true });
  } catch {
    res.status(404).json({ error: '채널을 찾을 수 없습니다.' });
  }
});

router.patch('/channels/:id', authMiddleware, requireStaffPermission('ads.settings'), async (req, res) => {
  const user = authUser(req);
  const tenantId = requireTenantFromReq(req, res);
  if (!tenantId) return;
  const { id } = req.params;
  const body = req.body as { name?: string; isActive?: boolean; sortOrder?: number };
  const isSuper = isTenantOwnerAdmin(user);

  const data: { name?: string; isActive?: boolean; sortOrder?: number } = {};
  if (isSuper) {
    if (body.name != null) data.name = String(body.name).trim();
    if (body.isActive != null) data.isActive = Boolean(body.isActive);
    if (body.sortOrder != null && typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder;
  } else {
    if (body.name != null || body.sortOrder != null) {
      res.status(403).json({ error: '채널 이름·표시 순서 변경은 최고 관리자만 가능합니다.' });
      return;
    }
    if (body.isActive == null) {
      res.status(400).json({ error: '사용 여부만 변경할 수 있습니다.' });
      return;
    }
    data.isActive = Boolean(body.isActive);
  }

  if (Object.keys(data).length === 0) {
    res.status(400).json({ error: '수정할 내용이 없습니다.' });
    return;
  }
  try {
    const owned = await prisma.adChannel.findFirst({ where: { id, tenantId } });
    if (!owned) {
      res.status(404).json({ error: '채널을 찾을 수 없습니다.' });
      return;
    }
    const row = await prisma.adChannel.update({ where: { id }, data });
    res.json(row);
  } catch {
    res.status(404).json({ error: '채널을 찾을 수 없습니다.' });
  }
});

router.post('/sessions/start', authMiddleware, requireStaffPermission('ads.sessions'), async (req, res) => {
  const user = authUser(req);
  const tenantId = requireTenantFromReq(req, res);
  if (!tenantId) return;
  const existing = await prisma.adWorkSession.findFirst({
    where: { tenantId, userId: user.userId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  if (existing) {
    res.status(400).json({ error: '이미 진행 중인 작업이 있습니다. 종료 후 다시 시작할 수 있습니다.' });
    return;
  }
  const session = await prisma.adWorkSession.create({
    data: { tenantId, userId: user.userId, startedAt: new Date() },
  });
  res.json(session);
});

router.get('/sessions/active', authMiddleware, requireStaffPermission('ads.sessions'), async (req, res) => {
  const user = authUser(req);
  const tenantId = requireTenantFromReq(req, res);
  if (!tenantId) return;
  const session = await prisma.adWorkSession.findFirst({
    where: { tenantId, userId: user.userId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  res.json({ session });
});

/** 종료 입력 모달 — 확정 예약(고객 제출) 분모 미리보기 + 미제출 발급 참고 */
router.get('/sessions/booking-denominator-preview', authMiddleware, requireStaffPermission('ads.sessions'), async (req, res) => {
  const user = authUser(req);
  const tenantId = requireTenantFromReq(req, res);
  if (!tenantId) return;
  const session = await prisma.adWorkSession.findFirst({
    where: { tenantId, userId: user.userId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  if (!session) {
    res.json({
      session: null,
      autoCount: 0,
      issuedPendingCount: 0,
      cancelledCount: 0,
      deletedCount: 0,
      rangeStartIso: null as string | null,
    });
    return;
  }
  const prevEnded = await prisma.adWorkSession.findFirst({
    where: { tenantId, userId: user.userId, endedAt: { not: null } },
    orderBy: { endedAt: 'desc' },
  });
  const rangeStart = prevEnded?.endedAt ?? session.startedAt;
  const now = new Date();
  const breakdown = await countBookingDenominatorAuto(prisma, tenantId, user.userId, rangeStart, now);
  res.json({
    sessionId: session.id,
    rangeStartIso: rangeStart.toISOString(),
    autoCount: breakdown.activeCount,
    issuedPendingCount: breakdown.issuedPendingCount,
    cancelledCount: breakdown.cancelledCount,
    deletedCount: breakdown.deletedCount,
  });
});

router.post('/sessions/end', authMiddleware, requireStaffPermission('ads.sessions'), async (req, res) => {
  const user = authUser(req);
  const tenantId = requireTenantFromReq(req, res);
  if (!tenantId) return;
  const body = req.body as {
    lines?: RawAdSessionEndLine[];
    bookingDenominator?: { manual?: boolean; manualCount?: number };
  };
  const rawLines = Array.isArray(body.lines) ? body.lines : [];
  const session = await prisma.adWorkSession.findFirst({
    where: { tenantId, userId: user.userId, endedAt: null },
    orderBy: { startedAt: 'desc' },
  });
  if (!session) {
    res.status(400).json({ error: '진행 중인 작업이 없습니다.' });
    return;
  }

  const prevEnded = await prisma.adWorkSession.findFirst({
    where: { tenantId, userId: user.userId, endedAt: { not: null } },
    orderBy: { endedAt: 'desc' },
  });

  const activeChannels = await prisma.adChannel.findMany({
    where: { tenantId, isActive: true },
    include: { lineItems: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }] } },
  });

  const norm = normalizeAdSessionEndLines(rawLines, activeChannels);
  if (!norm.ok) {
    res.status(400).json({ error: norm.error });
    return;
  }
  const normalized = norm.rows;

  if (normalized.length > 0) {
    const total = normalized.reduce((s, l) => s + l.amount, 0);
    if (total <= 0) {
      res.status(400).json({ error: '채널별 금액 합계가 0보다 커야 합니다.' });
      return;
    }
  }

  function normalizedRowsHaveDenomOnlyLines(rows: NormalizedAdSpendRow[]): boolean {
    for (const r of rows) {
      if (r.countBreakdown?.some((c) => !c.countsForSpend)) return true;
    }
    return false;
  }

  const endedAt = new Date();

  let bookingDenominatorCount: number | null = null;
  let bookingDenominatorManual = false;

  if (normalizedRowsHaveDenomOnlyLines(normalized)) {
    const bd = body.bookingDenominator;
    const manual = Boolean(bd?.manual);
    if (manual) {
      const mc = bd?.manualCount;
      if (typeof mc !== 'number' || !Number.isFinite(mc) || mc < 0) {
        res.status(400).json({
          error: '예약 건수 수동 입력을 켠 경우 0 이상의 숫자를 입력해 주세요.',
        });
        return;
      }
      bookingDenominatorCount = Math.floor(mc);
      bookingDenominatorManual = true;
    } else {
      const rangeStart = prevEnded?.endedAt ?? session.startedAt;
      const breakdown = await countBookingDenominatorAuto(
        prisma,
        tenantId,
        user.userId,
        rangeStart,
        endedAt,
      );
      bookingDenominatorCount = breakdown.activeCount;
      bookingDenominatorManual = false;
    }
    applyResolvedBookingDenominator(normalized, bookingDenominatorCount);
  }

  function soomgoCountsFromBreakdown(
    bd: NormalizedAdSpendRow['countBreakdown']
  ): { r: number | null; a: number | null; c: number | null } {
    if (!bd?.length) return { r: null, a: null, c: null };
    let r: number | null = null;
    let a: number | null = null;
    let c: number | null = null;
    const compact = (s: string) => s.replace(/\s+/g, '');
    for (const row of bd) {
      const t = compact(row.label);
      if (t.includes('받은요청')) r = row.count;
      else if (t.includes('자동견적')) a = row.count;
      else if (t.includes('예약확정')) c = row.count;
    }
    return { r, a, c };
  }

  await prisma.$transaction(async (tx) => {
    if (normalized.length > 0) {
      await tx.adSpendLine.createMany({
        data: normalized.map((l) => {
          const sg =
            l.countBreakdown && l.countBreakdown.length > 0
              ? soomgoCountsFromBreakdown(l.countBreakdown)
              : { r: null, a: null, c: null };
          return {
            sessionId: session.id,
            channelId: l.channelId,
            amount: l.amount,
            soomgoReceivedCount: sg.r,
            soomgoAutoEstimateCount: sg.a,
            soomgoConfirmedCount: sg.c,
            countBreakdown: l.countBreakdown ?? undefined,
          };
        }),
      });
    }
    await tx.adWorkSession.update({
      where: { id: session.id },
      data: {
        endedAt,
        bookingDenominatorCount,
        bookingDenominatorManual,
      },
    });
  });

  const updated = await prisma.adWorkSession.findUnique({
    where: { id: session.id },
    include: { spendLines: { include: { channel: true } } },
  });
  res.json({ session: updated });
});

/** 마케터별 당월(또는 지정 월) KST 일자별 광고비·예약 분모·건당 비용 */
router.get('/analytics/daily', authMiddleware, requireStaffPermission('ads.analytics'), async (req, res) => {
  const user = authUser(req);
  const tenantId = requireTenantFromReq(req, res);
  if (!tenantId) return;
  const monthKey = typeof req.query.month === 'string' ? req.query.month.trim() : '';
  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    res.status(400).json({ error: 'month (YYYY-MM)를 지정해 주세요.' });
    return;
  }

  let marketerId =
    typeof req.query.marketerId === 'string' && /^[0-9a-f-]{36}$/i.test(req.query.marketerId.trim())
      ? req.query.marketerId.trim()
      : '';
  if (user.role !== 'ADMIN') {
    marketerId = user.userId;
  }
  if (!marketerId) {
    res.status(400).json({ error: 'marketerId가 필요합니다.' });
    return;
  }
  if (user.role !== 'ADMIN' && marketerId !== user.userId) {
    res.status(403).json({ error: '다른 사용자 데이터를 조회할 수 없습니다.' });
    return;
  }

  const target = await prisma.user.findFirst({
    where: { id: marketerId, tenantId },
    select: { id: true, name: true, email: true, role: true },
  });
  if (!target) {
    res.status(404).json({ error: '사용자를 찾을 수 없습니다.' });
    return;
  }

  try {
    const payload = await advertisingDailySettlementForMonthKey(prisma, tenantId, marketerId, monthKey);
    res.json({
      marketer: {
        id: target.id,
        name: target.name,
        email: target.email,
        role: target.role,
      },
      month: monthKey,
      ...payload,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'invalid_month') {
      res.status(400).json({ error: '유효한 월(YYYY-MM)이 아닙니다.' });
      return;
    }
    console.error('[advertising /analytics/daily]', e);
    res.status(500).json({ error: '일별 정산을 불러오지 못했습니다.' });
  }
});

router.get('/analytics', authMiddleware, requireStaffPermission('ads.analytics'), async (req, res) => {
  const user = authUser(req);
  const tenantId = requireTenantFromReq(req, res);
  if (!tenantId) return;
  const range = parseRange(
    typeof req.query.from === 'string' ? req.query.from : undefined,
    typeof req.query.to === 'string' ? req.query.to : undefined
  );
  if (!range) {
    res.status(400).json({ error: 'from, to (YYYY-MM-DD)를 지정해주세요.' });
    return;
  }

  const scope = resolveMarketerScope(user, typeof req.query.marketerId === 'string' ? req.query.marketerId : undefined);
  if (user.role !== 'ADMIN' && req.query.marketerId) {
    res.status(403).json({ error: '다른 사용자 데이터를 조회할 수 없습니다.' });
    return;
  }

  const days = inclusiveDayCount(range.fromYmd, range.toYmd);

  const sessionWhere: {
    tenantId: string;
    endedAt: { not: null; gte: Date; lte: Date };
    userId?: { in: string[] };
  } = {
    tenantId,
    endedAt: { not: null, gte: range.from, lte: range.to },
  };
  if (scope.marketerIds !== 'ALL_MARKETERS') {
    sessionWhere.userId = { in: scope.marketerIds };
  }

  /**
   * 접수 매출 집계용: 발주서 고객 제출일이 기간 안이고 상태가 예약완료·분배·진행 등.
   * 예약완료 「건수」는 submittedAt·tenantId 기준 확정 제출 — `sumReservationCountsFromWorkSessionsInPeriod`
   */
  const orderFormSubmittedInPeriod = {
    submittedAt: {
      not: null,
      gte: range.from,
      lte: range.to,
    },
  };

  const inquiryWhere: Prisma.InquiryWhereInput = {
    tenantId,
    orderFormId: { not: null },
    status: { in: ADVERTISING_ANALYTICS_RESERVATION_STATUSES },
    orderForm: {
      is: orderFormSubmittedInPeriod,
    },
  };
  if (scope.marketerIds !== 'ALL_MARKETERS') {
    inquiryWhere.orderForm = {
      is: {
        ...orderFormSubmittedInPeriod,
        createdById: { in: scope.marketerIds },
      },
    };
  }

  /** 세션·지출: user 객체 없이 최소 필드만 (메모리 절약) */
  const [sessions, reservationAgg, inquiryRows] = await Promise.all([
    prisma.adWorkSession.findMany({
      where: sessionWhere,
      select: {
        userId: true,
        spendLines: { select: { amount: true } },
      },
    }),
    sumReservationCountsFromWorkSessionsInPeriod(
      prisma,
      tenantId,
      range.from,
      range.to,
      scope.marketerIds,
    ),
    prisma.inquiry.findMany({
      where: inquiryWhere,
      select: {
        createdById: true,
        serviceTotalAmount: true,
        orderForm: { select: { createdById: true } },
      },
    }),
  ]);

  const reservationByUser = reservationAgg.byUser;
  const cancelledReservationByUser = reservationAgg.cancelledByUser;
  const deletedReservationByUser = reservationAgg.deletedByUser;
  const inquiryCount = reservationAgg.total;
  const cancelledInquiryCount = reservationAgg.cancelledTotal;
  const deletedInquiryCount = reservationAgg.deletedTotal;
  const issuedPendingInquiryCount = reservationAgg.issuedPendingTotal;

  const totalSpend = sumSpendFromSessions(sessions);
  let totalRevenue = 0;
  const revenueByUser = new Map<string, number>();
  for (const row of inquiryRows) {
    const amt = row.serviceTotalAmount ?? 0;
    totalRevenue += amt;
    const uid = row.orderForm?.createdById ?? row.createdById ?? null;
    if (!uid) continue;
    revenueByUser.set(uid, (revenueByUser.get(uid) ?? 0) + amt);
  }
  const roas = totalSpend > 0 ? totalRevenue / totalSpend : null;
  const costPerInquiry = inquiryCount > 0 ? totalSpend / inquiryCount : null;
  const avgDailySpend = totalSpend / days;

  const spendByUser = new Map<string, number>();
  for (const s of sessions) {
    const u = s.userId;
    let add = 0;
    for (const l of s.spendLines) add += l.amount;
    spendByUser.set(u, (spendByUser.get(u) ?? 0) + add);
  }

  let rowUsers: { id: string; name: string; email: string; role: string }[] = [];
  if (scope.marketerIds === 'ALL_MARKETERS') {
    const marketers = await loadMarketerUsers(prisma, tenantId, scope);
    const mIds = new Set(marketers.map((m) => m.id));
    const extraIds = new Set<string>();
    for (const uid of spendByUser.keys()) {
      if (!mIds.has(uid)) extraIds.add(uid);
    }
    for (const uid of revenueByUser.keys()) {
      if (!mIds.has(uid)) extraIds.add(uid);
    }
    for (const uid of reservationByUser.keys()) {
      if (!mIds.has(uid)) extraIds.add(uid);
    }
    for (const uid of cancelledReservationByUser.keys()) {
      if (!mIds.has(uid)) extraIds.add(uid);
    }
    for (const uid of deletedReservationByUser.keys()) {
      if (!mIds.has(uid)) extraIds.add(uid);
    }
    for (const uid of reservationAgg.issuedPendingByUser.keys()) {
      if (!mIds.has(uid)) extraIds.add(uid);
    }
    const extras =
      extraIds.size > 0
        ? await prisma.user.findMany({
            where: { tenantId, id: { in: [...extraIds] }, role: 'ADMIN', isActive: true },
            select: { id: true, name: true, email: true, role: true },
          })
        : [];
    rowUsers = [
      ...marketers.map((m) => ({ ...m, role: 'MARKETER' })),
      ...extras,
    ];
  } else {
    const one = await prisma.user.findUnique({
      where: { id: scope.marketerIds[0] },
      select: { id: true, name: true, email: true, role: true },
    });
    rowUsers = one ? [one] : [];
  }

  const byUser = rowUsers.map((u) => {
    const spend = spendByUser.get(u.id) ?? 0;
    const rev = revenueByUser.get(u.id) ?? 0;
    const ic = reservationByUser.get(u.id) ?? 0;
    const cc = cancelledReservationByUser.get(u.id) ?? 0;
    const dc = deletedReservationByUser.get(u.id) ?? 0;
    const ipc = reservationAgg.issuedPendingByUser.get(u.id) ?? 0;
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      totalAdSpend: spend,
      orderInquiryCount: ic,
      issuedPendingInquiryCount: ipc,
      cancelledInquiryCount: cc,
      deletedInquiryCount: dc,
      totalRevenue: rev,
      roas: spend > 0 ? rev / spend : null,
      costPerInquiry: ic > 0 ? spend / ic : null,
      avgDailySpend: spend / days,
    };
  });

  byUser.sort((a, b) => b.totalAdSpend - a.totalAdSpend);

  res.json({
    period: { from: range.fromYmd, to: range.toYmd, days },
    summary: {
      totalAdSpend: totalSpend,
      orderInquiryCount: inquiryCount,
      issuedPendingInquiryCount,
      cancelledInquiryCount,
      deletedInquiryCount,
      totalRevenue,
      roas,
      costPerInquiry,
      avgDailySpend,
    },
    byUser,
  });
});

router.get('/sessions/history', authMiddleware, requireStaffPermission('ads.sessions'), async (req, res) => {
  const user = authUser(req);
  const tenantId = requireTenantFromReq(req, res);
  if (!tenantId) return;
  const range = parseRange(
    typeof req.query.from === 'string' ? req.query.from : undefined,
    typeof req.query.to === 'string' ? req.query.to : undefined
  );
  if (!range) {
    res.status(400).json({ error: 'from, to (YYYY-MM-DD)를 지정해주세요.' });
    return;
  }

  const scope = resolveMarketerScope(user, typeof req.query.marketerId === 'string' ? req.query.marketerId : undefined);
  if (user.role !== 'ADMIN' && req.query.marketerId) {
    res.status(403).json({ error: '다른 사용자 데이터를 조회할 수 없습니다.' });
    return;
  }

  const where: {
    tenantId: string;
    endedAt: { not: null; gte: Date; lte: Date };
    userId?: { in: string[] };
  } = {
    tenantId,
    endedAt: { not: null, gte: range.from, lte: range.to },
  };
  if (scope.marketerIds !== 'ALL_MARKETERS') {
    where.userId = { in: scope.marketerIds };
  }

  const limitRaw = typeof req.query.limit === 'string' ? parseInt(req.query.limit, 10) : NaN;
  const limit = Number.isFinite(limitRaw) ? Math.min(Math.max(1, Math.floor(limitRaw)), 100) : 5;
  const offsetRaw = typeof req.query.offset === 'string' ? parseInt(req.query.offset, 10) : 0;
  const offset = Number.isFinite(offsetRaw) ? Math.max(0, Math.floor(offsetRaw)) : 0;

  const [total, sessions] = await Promise.all([
    prisma.adWorkSession.count({ where }),
    prisma.adWorkSession.findMany({
      where,
      include: {
        spendLines: { include: { channel: true } },
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { endedAt: 'desc' },
      take: limit,
      skip: offset,
    }),
  ]);

  res.json({ items: sessions, total });
});

export default router;
