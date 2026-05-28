import type { InquiryStatus, Prisma, PrismaClient } from '@prisma/client';
import type { NormalizedAdSpendRow } from './advertising.sessionEndNormalize.js';

export type BookingDenominatorBreakdown = {
  /** 확정 예약완료 — 고객 제출(submittedAt) 완료·접수 취소·삭제 제외. 광고 ROI·수당·세션 분모 */
  activeCount: number;
  /** 미제출 발급(링크만) — 활동 참고용, 금액 분모·예약완료 건수 제외 */
  issuedPendingCount: number;
  /** 고객 제출 후 접수 CANCELLED */
  cancelledCount: number;
  /** 제출 후 접수만 삭제(고아) · 발주서 영구 삭제 로그(제출분) */
  deletedCount: number;
};

type DenominatorClass = 'active' | 'cancelled' | 'deleted';

const orderFormDenominatorSelect = {
  id: true,
  submittedAt: true,
  inquiries: {
    select: { status: true },
    orderBy: { createdAt: 'desc' as const },
    take: 1,
  },
} as const;

function emptyBreakdown(): BookingDenominatorBreakdown {
  return { activeCount: 0, issuedPendingCount: 0, cancelledCount: 0, deletedCount: 0 };
}

function addBreakdown(a: BookingDenominatorBreakdown, b: BookingDenominatorBreakdown): BookingDenominatorBreakdown {
  return {
    activeCount: a.activeCount + b.activeCount,
    issuedPendingCount: a.issuedPendingCount + b.issuedPendingCount,
    cancelledCount: a.cancelledCount + b.cancelledCount,
    deletedCount: a.deletedCount + b.deletedCount,
  };
}

/** KST yyyy-mm-dd */
export function submittedAtYmdKst(d: Date): string {
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function classifySubmittedOrderForm(row: {
  submittedAt: Date | null;
  inquiries: { status: InquiryStatus }[];
}): DenominatorClass {
  if (row.submittedAt == null) return 'deleted';
  if (row.inquiries.length > 0) {
    return row.inquiries[0]!.status === 'CANCELLED' ? 'cancelled' : 'active';
  }
  /** 고객 제출 후 접수만 삭제된 발주서 */
  return 'deleted';
}

function tallySubmittedRows(rows: { submittedAt: Date | null; inquiries: { status: InquiryStatus }[] }[]): Omit<
  BookingDenominatorBreakdown,
  'issuedPendingCount'
> {
  let activeCount = 0;
  let cancelledCount = 0;
  let deletedCount = 0;
  for (const row of rows) {
    const cls = classifySubmittedOrderForm(row);
    if (cls === 'cancelled') cancelledCount += 1;
    else if (cls === 'deleted') deletedCount += 1;
    else activeCount += 1;
  }
  return { activeCount, cancelledCount, deletedCount };
}

function marketerCreatedByFilter(marketerIds: string[] | 'ALL_MARKETERS'): Prisma.OrderFormWhereInput {
  if (marketerIds === 'ALL_MARKETERS') return {};
  return { createdById: { in: marketerIds } };
}

function marketerDeleteLogFilter(
  tenantId: string,
  marketerIds: string[] | 'ALL_MARKETERS',
): Prisma.OrderFormDeleteLogWhereInput {
  const base: Prisma.OrderFormDeleteLogWhereInput = {
    createdBy: { tenantId },
  };
  if (marketerIds === 'ALL_MARKETERS') return base;
  return { ...base, createdById: { in: marketerIds } };
}

/** DB에 남은 고아 발주서와 삭제 로그가 겹치면 삭제 로그 쪽은 제외(이중 집계 방지) */
function orphanSubmittedOrderFormIds(
  rows: { id: string; submittedAt: Date | null; inquiries: { status: InquiryStatus }[] }[],
): Set<string> {
  const out = new Set<string>();
  for (const row of rows) {
    if (row.submittedAt != null && row.inquiries.length === 0) {
      out.add(row.id);
    }
  }
  return out;
}

/**
 * 세션 구간(직전 종료~이번 종료/지금) — 텔레마 세션 종료 시 채널 건당 분모.
 * 확정(active)은 고객 제출(submittedAt)만. 미제출 발급은 issuedPendingCount.
 */
export async function countBookingDenominatorAuto(
  prisma: PrismaClient,
  tenantId: string,
  marketerUserId: string,
  rangeStartExclusive: Date,
  rangeEndInclusive: Date,
): Promise<BookingDenominatorBreakdown> {
  const [submittedInRange, pendingIssuedInRange, deletedSubmittedLogs] = await Promise.all([
    prisma.orderForm.findMany({
      where: {
        tenantId,
        createdById: marketerUserId,
        submittedAt: {
          gt: rangeStartExclusive,
          lte: rangeEndInclusive,
        },
      },
      select: orderFormDenominatorSelect,
    }),
    prisma.orderForm.findMany({
      where: {
        tenantId,
        createdById: marketerUserId,
        submittedAt: null,
        createdAt: {
          gt: rangeStartExclusive,
          lte: rangeEndInclusive,
        },
      },
      select: { id: true },
    }),
    prisma.orderFormDeleteLog.findMany({
      where: {
        createdById: marketerUserId,
        createdBy: { tenantId },
        submittedAt: {
          not: null,
          gt: rangeStartExclusive,
          lte: rangeEndInclusive,
        },
      },
      select: { orderFormId: true },
    }),
  ]);

  const orphanIds = orphanSubmittedOrderFormIds(submittedInRange);
  const tallied = tallySubmittedRows(submittedInRange);
  const deletedLogCount = deletedSubmittedLogs.filter((l) => !orphanIds.has(l.orderFormId)).length;
  return {
    activeCount: tallied.activeCount,
    issuedPendingCount: pendingIssuedInRange.length,
    cancelledCount: tallied.cancelledCount,
    deletedCount: tallied.deletedCount + deletedLogCount,
  };
}

/**
 * 조회 기간(KST from~to) 내 `submittedAt` 기준 확정·취소·삭제 집계.
 * 광고 분석 「예약완료 건수」·건당 비용·마케터 수당 일자 귀속에 사용.
 */
export async function sumConfirmedReservationCountsInPeriod(
  prisma: PrismaClient,
  tenantId: string,
  rangeFrom: Date,
  rangeTo: Date,
  marketerIds: string[] | 'ALL_MARKETERS',
): Promise<BookingDenominatorBreakdown & { byUser: Map<string, BookingDenominatorBreakdown> }> {
  const marketerFilter = marketerCreatedByFilter(marketerIds);
  const logMarketerFilter = marketerDeleteLogFilter(tenantId, marketerIds);

  const [submittedInRange, pendingIssuedInRange, deletedSubmittedLogs] = await Promise.all([
    prisma.orderForm.findMany({
      where: {
        tenantId,
        ...marketerFilter,
        submittedAt: { gte: rangeFrom, lte: rangeTo },
      },
      select: {
        ...orderFormDenominatorSelect,
        createdById: true,
      },
    }),
    prisma.orderForm.findMany({
      where: {
        tenantId,
        ...marketerFilter,
        submittedAt: null,
        createdAt: { gte: rangeFrom, lte: rangeTo },
      },
      select: { createdById: true },
    }),
    prisma.orderFormDeleteLog.findMany({
      where: {
        ...logMarketerFilter,
        submittedAt: { not: null, gte: rangeFrom, lte: rangeTo },
      },
      select: { createdById: true, orderFormId: true },
    }),
  ]);

  const byUser = new Map<string, BookingDenominatorBreakdown>();
  const orphanIds = orphanSubmittedOrderFormIds(submittedInRange);

  const ensure = (uid: string): BookingDenominatorBreakdown => {
    let b = byUser.get(uid);
    if (!b) {
      b = emptyBreakdown();
      byUser.set(uid, b);
    }
    return b;
  };

  for (const row of submittedInRange) {
    const uid = row.createdById;
    const b = ensure(uid);
    const cls = classifySubmittedOrderForm(row);
    if (cls === 'cancelled') b.cancelledCount += 1;
    else if (cls === 'deleted') b.deletedCount += 1;
    else b.activeCount += 1;
  }

  for (const row of pendingIssuedInRange) {
    ensure(row.createdById).issuedPendingCount += 1;
  }

  for (const row of deletedSubmittedLogs) {
    if (orphanIds.has(row.orderFormId)) continue;
    ensure(row.createdById).deletedCount += 1;
  }

  let total = emptyBreakdown();
  for (const b of byUser.values()) {
    total = addBreakdown(total, b);
  }

  return { ...total, byUser };
}

/** @deprecated — `sumConfirmedReservationCountsInPeriod` 사용 */
export type ReservationCountPeriodAgg = {
  total: number;
  cancelledTotal: number;
  deletedTotal: number;
  issuedPendingTotal: number;
  byUser: Map<string, number>;
  cancelledByUser: Map<string, number>;
  deletedByUser: Map<string, number>;
  issuedPendingByUser: Map<string, number>;
};

/** 광고 분석 API 호환 래퍼 — submittedAt·tenantId 기준 */
export async function sumReservationCountsFromWorkSessionsInPeriod(
  prisma: PrismaClient,
  tenantId: string,
  rangeFrom: Date,
  rangeTo: Date,
  marketerIds: string[] | 'ALL_MARKETERS',
): Promise<ReservationCountPeriodAgg> {
  const agg = await sumConfirmedReservationCountsInPeriod(
    prisma,
    tenantId,
    rangeFrom,
    rangeTo,
    marketerIds,
  );

  const byUser = new Map<string, number>();
  const cancelledByUser = new Map<string, number>();
  const deletedByUser = new Map<string, number>();
  const issuedPendingByUser = new Map<string, number>();

  for (const [uid, b] of agg.byUser) {
    byUser.set(uid, b.activeCount);
    cancelledByUser.set(uid, b.cancelledCount);
    deletedByUser.set(uid, b.deletedCount);
    issuedPendingByUser.set(uid, b.issuedPendingCount);
  }

  return {
    total: agg.activeCount,
    cancelledTotal: agg.cancelledCount,
    deletedTotal: agg.deletedCount,
    issuedPendingTotal: agg.issuedPendingCount,
    byUser,
    cancelledByUser,
    deletedByUser,
    issuedPendingByUser,
  };
}

/** 마케터 1명 · 기간 내 확정 제출 건수 (수당·접수 집계) */
export async function countMarketerConfirmedSubmissionsInRange(
  prisma: PrismaClient,
  tenantId: string,
  marketerUserId: string,
  rangeGte: Date,
  rangeLte: Date,
): Promise<BookingDenominatorBreakdown> {
  const agg = await sumConfirmedReservationCountsInPeriod(
    prisma,
    tenantId,
    rangeGte,
    rangeLte,
    [marketerUserId],
  );
  return {
    activeCount: agg.activeCount,
    issuedPendingCount: agg.issuedPendingCount,
    cancelledCount: agg.cancelledCount,
    deletedCount: agg.deletedCount,
  };
}

/**
 * 합산 제외 과목이 여러 개여도 평균 분모는 하나의 건수만 사용.
 * - 라벨에 「예약확정」이 있으면 그 과목(숨고 등 표준 명칭)
 * - 없으면 채널 설정 순서상 첫 합산 제외 과목 (UUID 정렬 금지 — 예약확정에 안 들어가던 버그 방지)
 */
export function applyResolvedBookingDenominator(
  rows: NormalizedAdSpendRow[],
  resolved: number,
): void {
  const d = Math.max(0, Math.floor(Number(resolved)));
  for (const row of rows) {
    if (!row.countBreakdown?.length) continue;
    const denomCells = row.countBreakdown.filter((c) => !c.countsForSpend);
    if (denomCells.length === 0) continue;

    const compactLabel = (s: string) => s.replace(/\s+/g, '');
    const preferred = denomCells.find((c) => compactLabel(c.label).includes('예약확정'));
    const chosenId = preferred?.lineItemId ?? denomCells[0]!.lineItemId;

    for (const cell of row.countBreakdown) {
      if (cell.countsForSpend) continue;
      cell.count = cell.lineItemId === chosenId ? d : 0;
      cell.lineAmountWon = 0;
      cell.useAsAvgDenominator = true;
    }
  }
}
