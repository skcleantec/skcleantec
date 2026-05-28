import type { PrismaClient } from '@prisma/client';
import { kstMonthRangeYm } from '../inquiries/inquiryListDateRange.js';
import { submittedAtYmdKst, sumConfirmedReservationCountsInPeriod } from './advertising.bookingDenominator.js';

function endedAtToYmdKst(d: Date): string {
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
}

function kstMonthDayYmds(monthKey: string): string[] | null {
  if (!kstMonthRangeYm(monthKey)) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(monthKey);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const lastDay = new Date(y, mo, 0).getDate();
  const out: string[] = [];
  for (let d = 1; d <= lastDay; d++) {
    out.push(`${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`);
  }
  return out;
}

export type AdvertisingDailySettlementDay = {
  ymd: string;
  totalAdSpend: number;
  reservationCount: number;
  issuedPendingCount: number;
  cancelledReservationCount: number;
  deletedReservationCount: number;
  costPerReservation: number | null;
};

/**
 * 한 사용자·한 달(KST):
 * - 광고비: 작업 종료 세션 `endedAt` KST 일자
 * - 예약완료·취소·삭제: 발주서 `submittedAt` KST 일자 (확정 제출 기준)
 */
export async function advertisingDailySettlementForMonthKey(
  prisma: PrismaClient,
  tenantId: string,
  marketerUserId: string,
  monthKey: string,
): Promise<{
  days: AdvertisingDailySettlementDay[];
  monthTotals: {
    totalAdSpend: number;
    reservationCount: number;
    issuedPendingCount: number;
    cancelledReservationCount: number;
    deletedReservationCount: number;
    costPerReservation: number | null;
  };
}> {
  const monthRange = kstMonthRangeYm(monthKey);
  if (!monthRange) {
    throw new Error('invalid_month');
  }
  const { gte: monthGte, lte: monthLte } = monthRange;

  const chain = await prisma.adWorkSession.findMany({
    where: {
      tenantId,
      userId: marketerUserId,
      endedAt: { not: null, lte: monthLte },
    },
    select: {
      endedAt: true,
      spendLines: { select: { amount: true } },
    },
    orderBy: { endedAt: 'asc' },
  });

  const spendByDay = new Map<string, number>();
  for (const row of chain) {
    const endedAt = row.endedAt!;
    if (endedAt < monthGte || endedAt > monthLte) continue;
    const ymd = endedAtToYmdKst(endedAt);
    const spend = row.spendLines.reduce((s, l) => s + l.amount, 0);
    spendByDay.set(ymd, (spendByDay.get(ymd) ?? 0) + spend);
  }

  const [submittedInMonth, pendingIssuedInMonth, deletedSubmittedLogs] = await Promise.all([
    prisma.orderForm.findMany({
      where: {
        tenantId,
        createdById: marketerUserId,
        submittedAt: { gte: monthGte, lte: monthLte },
      },
      select: {
        id: true,
        submittedAt: true,
        inquiries: {
          select: { status: true },
          orderBy: { createdAt: 'desc' as const },
          take: 1,
        },
      },
    }),
    prisma.orderForm.findMany({
      where: {
        tenantId,
        createdById: marketerUserId,
        submittedAt: null,
        createdAt: { gte: monthGte, lte: monthLte },
      },
      select: { createdAt: true },
    }),
    prisma.orderFormDeleteLog.findMany({
      where: {
        createdById: marketerUserId,
        createdBy: { tenantId },
        submittedAt: { not: null, gte: monthGte, lte: monthLte },
      },
      select: { submittedAt: true, orderFormId: true },
    }),
  ]);

  const orphanIds = new Set(
    submittedInMonth.filter((row) => row.submittedAt != null && row.inquiries.length === 0).map((row) => row.id),
  );

  type DayCounts = { count: number; issued: number; cancelled: number; deleted: number };
  const countsByDay = new Map<string, DayCounts>();

  const ensureDay = (ymd: string): DayCounts => {
    let cur = countsByDay.get(ymd);
    if (!cur) {
      cur = { count: 0, issued: 0, cancelled: 0, deleted: 0 };
      countsByDay.set(ymd, cur);
    }
    return cur;
  };

  for (const row of submittedInMonth) {
    if (!row.submittedAt) continue;
    const ymd = submittedAtYmdKst(row.submittedAt);
    const cur = ensureDay(ymd);
    if (row.inquiries.length > 0 && row.inquiries[0]!.status === 'CANCELLED') {
      cur.cancelled += 1;
    } else if (row.inquiries.length === 0) {
      cur.deleted += 1;
    } else {
      cur.count += 1;
    }
  }

  for (const row of pendingIssuedInMonth) {
    const ymd = submittedAtYmdKst(row.createdAt);
    ensureDay(ymd).issued += 1;
  }

  for (const row of deletedSubmittedLogs) {
    if (!row.submittedAt || orphanIds.has(row.orderFormId)) continue;
    const ymd = submittedAtYmdKst(row.submittedAt);
    ensureDay(ymd).deleted += 1;
  }

  const ymds = kstMonthDayYmds(monthKey);
  if (!ymds) {
    throw new Error('invalid_month');
  }

  let totalSpend = 0;
  let totalCount = 0;
  let totalIssued = 0;
  let totalCancelled = 0;
  let totalDeleted = 0;

  const days: AdvertisingDailySettlementDay[] = ymds.map((ymd) => {
    const spend = spendByDay.get(ymd) ?? 0;
    const agg = countsByDay.get(ymd) ?? { count: 0, issued: 0, cancelled: 0, deleted: 0 };
    totalSpend += spend;
    totalCount += agg.count;
    totalIssued += agg.issued;
    totalCancelled += agg.cancelled;
    totalDeleted += agg.deleted;
    return {
      ymd,
      totalAdSpend: spend,
      reservationCount: agg.count,
      issuedPendingCount: agg.issued,
      cancelledReservationCount: agg.cancelled,
      deletedReservationCount: agg.deleted,
      costPerReservation: spend > 0 && agg.count > 0 ? spend / agg.count : null,
    };
  });

  const monthAgg = await sumConfirmedReservationCountsInPeriod(
    prisma,
    tenantId,
    monthGte,
    monthLte,
    [marketerUserId],
  );

  return {
    days,
    monthTotals: {
      totalAdSpend: totalSpend,
      reservationCount: monthAgg.activeCount,
      issuedPendingCount: monthAgg.issuedPendingCount,
      cancelledReservationCount: monthAgg.cancelledCount,
      deletedReservationCount: monthAgg.deletedCount,
      costPerReservation: monthAgg.activeCount > 0 ? totalSpend / monthAgg.activeCount : null,
    },
  };
}
