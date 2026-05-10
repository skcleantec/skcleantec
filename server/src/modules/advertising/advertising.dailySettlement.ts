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
  costPerReservation: number | null;
};

/**
 * 한 사용자·한 달(KST): 작업 종료 세션을 `endedAt`의 KST 일자로 묶어 광고비·예약 분모·건당 비용.
 * 분모는 세션에 저장된 값 우선, 없으면 직전 종료~이번 종료 자동 집계(광고 분석과 동일).
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
      bookingDenominatorCount: true,
      spendLines: { select: { amount: true } },
    },
    orderBy: { endedAt: 'asc' },
  });

  let prevEndedAt: Date | null = null;
  const pending: Array<{
    ymd: string;
    spend: number;
    stored: number | null;
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
        stored: row.bookingDenominatorCount,
        rangeStartExclusive,
        endedAt,
      });
    }

    prevEndedAt = endedAt;
  }

  const resolved = await Promise.all(
    pending.map((p) =>
      p.stored != null
        ? Promise.resolve(p.stored)
        : countBookingDenominatorAuto(prisma, marketerUserId, p.rangeStartExclusive, p.endedAt),
    ),
  );

  const byDay = new Map<string, { spend: number; count: number }>();
  for (let i = 0; i < pending.length; i++) {
    const p = pending[i]!;
    const c = resolved[i]!;
    const cur = byDay.get(p.ymd) ?? { spend: 0, count: 0 };
    cur.spend += p.spend;
    cur.count += c;
    byDay.set(p.ymd, cur);
  }

  const ymds = kstMonthDayYmds(monthKey);
  if (!ymds) {
    throw new Error('invalid_month');
  }

  let totalSpend = 0;
  let totalCount = 0;
  const days: AdvertisingDailySettlementDay[] = ymds.map((ymd) => {
    const agg = byDay.get(ymd) ?? { spend: 0, count: 0 };
    totalSpend += agg.spend;
    totalCount += agg.count;
    return {
      ymd,
      totalAdSpend: agg.spend,
      reservationCount: agg.count,
      costPerReservation: agg.count > 0 ? agg.spend / agg.count : null,
    };
  });

  return {
    days,
    monthTotals: {
      totalAdSpend: totalSpend,
      reservationCount: totalCount,
      costPerReservation: totalCount > 0 ? totalSpend / totalCount : null,
    },
  };
}
