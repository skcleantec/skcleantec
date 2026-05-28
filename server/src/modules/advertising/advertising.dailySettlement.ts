import type { PrismaClient } from '@prisma/client';
import { kstMonthRangeYm } from '../inquiries/inquiryListDateRange.js';
import { countBookingDenominatorAuto } from './advertising.bookingDenominator.js';

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
  cancelledReservationCount: number;
  deletedReservationCount: number;
  costPerReservation: number | null;
};

/**
 * 한 사용자·한 달(KST): 작업 종료 세션을 `endedAt`의 KST 일자로 묶어 광고비·예약 분모·건당 비용.
 * 분모는 세션 구간별 자동 집계(취소·삭제 제외, 현재 상태 기준).
 */
export async function advertisingDailySettlementForMonthKey(
  prisma: PrismaClient,
  marketerUserId: string,
  monthKey: string,
): Promise<{
  days: AdvertisingDailySettlementDay[];
  monthTotals: {
    totalAdSpend: number;
    reservationCount: number;
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
      userId: marketerUserId,
      endedAt: { not: null, lte: monthLte },
    },
    select: {
      startedAt: true,
      endedAt: true,
      spendLines: { select: { amount: true } },
    },
    orderBy: { endedAt: 'asc' },
  });

  let prevEndedAt: Date | null = null;
  const pending: Array<{
    ymd: string;
    spend: number;
    rangeStartExclusive: Date;
    endedAt: Date;
  }> = [];

  for (const row of chain) {
    const endedAt = row.endedAt!;
    const rangeStartExclusive = prevEndedAt ?? row.startedAt;
    const spend = row.spendLines.reduce((s, l) => s + l.amount, 0);

    if (endedAt >= monthGte && endedAt <= monthLte) {
      pending.push({
        ymd: endedAtToYmdKst(endedAt),
        spend,
        rangeStartExclusive,
        endedAt,
      });
    }

    prevEndedAt = endedAt;
  }

  const resolved = await Promise.all(
    pending.map((p) => countBookingDenominatorAuto(prisma, marketerUserId, p.rangeStartExclusive, p.endedAt)),
  );

  const byDay = new Map<string, { spend: number; count: number; cancelled: number; deleted: number }>();
  for (let i = 0; i < pending.length; i++) {
    const p = pending[i]!;
    const b = resolved[i]!;
    const cur = byDay.get(p.ymd) ?? { spend: 0, count: 0, cancelled: 0, deleted: 0 };
    cur.spend += p.spend;
    cur.count += b.activeCount;
    cur.cancelled += b.cancelledCount;
    cur.deleted += b.deletedCount;
    byDay.set(p.ymd, cur);
  }

  const ymds = kstMonthDayYmds(monthKey);
  if (!ymds) {
    throw new Error('invalid_month');
  }

  let totalSpend = 0;
  let totalCount = 0;
  let totalCancelled = 0;
  let totalDeleted = 0;
  const days: AdvertisingDailySettlementDay[] = ymds.map((ymd) => {
    const agg = byDay.get(ymd) ?? { spend: 0, count: 0, cancelled: 0, deleted: 0 };
    totalSpend += agg.spend;
    totalCount += agg.count;
    totalCancelled += agg.cancelled;
    totalDeleted += agg.deleted;
    return {
      ymd,
      totalAdSpend: agg.spend,
      reservationCount: agg.count,
      cancelledReservationCount: agg.cancelled,
      deletedReservationCount: agg.deleted,
      costPerReservation: agg.spend > 0 && agg.count > 0 ? agg.spend / agg.count : null,
    };
  });

  return {
    days,
    monthTotals: {
      totalAdSpend: totalSpend,
      reservationCount: totalCount,
      cancelledReservationCount: totalCancelled,
      deletedReservationCount: totalDeleted,
      costPerReservation: totalCount > 0 ? totalSpend / totalCount : null,
    },
  };
}
