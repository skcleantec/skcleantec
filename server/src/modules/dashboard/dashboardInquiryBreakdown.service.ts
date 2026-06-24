import { prisma } from '../../lib/prisma.js';
import { kstMonthRangeYm, kstTodayYmd, kstYmdKeysInRange } from '../inquiries/inquiryListDateRange.js';
import {
  listActiveServiceZoneRows,
  matchingServiceZonesForAddress,
  type ActiveServiceZoneRow,
} from '../service-zones/serviceZoneAssignment.js';
import {
  effectiveSalesDateYmd,
  getInquiryAmount,
  kstRecentMonthKeys,
  preferredDateYmd,
  SALES_AMOUNT_STATUSES,
} from './dashboardSales.helpers.js';

export type DashboardInquiryBreakdown = {
  monthKey: string;
  byServiceZone: Array<{
    serviceZoneId: string | null;
    name: string;
    inquiryCount: number;
    salesAmount: number;
  }>;
  byMonth: Array<{
    monthKey: string;
    inquiryCount: number;
    salesAmount: number;
  }>;
  byPreferredDate: Array<{
    date: string;
    inquiryCount: number;
  }>;
};

type InquirySalesRow = {
  createdAt: Date;
  address: string;
  areaPyeong: number | null;
  serviceTotalAmount: number | null;
  preferredDate: Date | null;
  orderForm: { totalAmount: number } | null;
  extraCharges: { amount: number }[];
};

function primaryServiceZoneId(
  address: string,
  zones: ActiveServiceZoneRow[],
): string | null {
  const matches = matchingServiceZonesForAddress(address, zones);
  return matches.length > 0 ? matches[0].id : null;
}

export async function buildDashboardInquiryBreakdown(
  tenantId: string,
): Promise<DashboardInquiryBreakdown> {
  const todayYmd = kstTodayYmd();
  const monthKey = todayYmd.slice(0, 7);
  const kstThisMonth = kstMonthRangeYm(monthKey);
  if (!kstThisMonth) {
    throw new Error('이번 달 구간을 계산할 수 없습니다.');
  }

  const monthKeys = kstRecentMonthKeys(6, monthKey);
  const earliestMonth = monthKeys[0];
  const earliestRange = kstMonthRangeYm(earliestMonth);
  if (!earliestRange) {
    throw new Error('집계 월 구간을 계산할 수 없습니다.');
  }

  const monthLastDay = kstThisMonth.lte
    .toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' })
    .slice(0, 10);

  const [estimateConfig, serviceZones, salesInquiries, preferredInquiries] = await Promise.all([
    prisma.estimateConfig.findUnique({ where: { tenantId } }).then((c) => c?.pricePerPyeong ?? 5000),
    listActiveServiceZoneRows(prisma, tenantId),
    prisma.inquiry.findMany({
      where: {
        tenantId,
        status: { in: [...SALES_AMOUNT_STATUSES] },
        createdAt: { gte: earliestRange.gte, lte: kstThisMonth.lte },
      },
      select: {
        createdAt: true,
        address: true,
        areaPyeong: true,
        serviceTotalAmount: true,
        preferredDate: true,
        orderForm: { select: { totalAmount: true } },
        extraCharges: { select: { amount: true } },
      },
    }),
    prisma.inquiry.findMany({
      where: {
        tenantId,
        preferredDate: { gte: kstThisMonth.gte, lte: kstThisMonth.lte },
        status: { notIn: ['CANCELLED', 'ON_HOLD'] },
      },
      select: { preferredDate: true },
    }),
  ]);

  const pricePerPyeong = estimateConfig;

  const zoneAgg = new Map<
    string | null,
    { serviceZoneId: string | null; name: string; inquiryCount: number; salesAmount: number }
  >();
  for (const z of serviceZones) {
    zoneAgg.set(z.id, {
      serviceZoneId: z.id,
      name: z.name,
      inquiryCount: 0,
      salesAmount: 0,
    });
  }
  zoneAgg.set(null, {
    serviceZoneId: null,
    name: '미분류',
    inquiryCount: 0,
    salesAmount: 0,
  });

  const monthAgg = new Map<string, { inquiryCount: number; salesAmount: number }>();
  for (const mk of monthKeys) {
    monthAgg.set(mk, { inquiryCount: 0, salesAmount: 0 });
  }

  for (const inq of salesInquiries as InquirySalesRow[]) {
    const ymd = effectiveSalesDateYmd(inq);
    const mk = ymd.slice(0, 7);
    const amt = getInquiryAmount(inq, pricePerPyeong);

    if (monthAgg.has(mk)) {
      const cur = monthAgg.get(mk)!;
      cur.inquiryCount += 1;
      cur.salesAmount += amt;
    }

    if (mk === monthKey) {
      const zid = primaryServiceZoneId(inq.address, serviceZones);
      const entry = zoneAgg.get(zid) ?? zoneAgg.get(null)!;
      entry.inquiryCount += 1;
      entry.salesAmount += amt;
    }
  }

  const preferredByYmd = new Map<string, number>();
  for (const ymd of kstYmdKeysInRange(`${monthKey}-01`, monthLastDay)) {
    preferredByYmd.set(ymd, 0);
  }
  for (const row of preferredInquiries) {
    if (!row.preferredDate) continue;
    const ymd = preferredDateYmd(row.preferredDate);
    if (!preferredByYmd.has(ymd)) continue;
    preferredByYmd.set(ymd, (preferredByYmd.get(ymd) ?? 0) + 1);
  }

  const byServiceZone = [...zoneAgg.values()]
    .filter((z) => z.inquiryCount > 0)
    .sort((a, b) => b.inquiryCount - a.inquiryCount || a.name.localeCompare(b.name, 'ko'));

  const byMonth = monthKeys.map((mk) => {
    const v = monthAgg.get(mk) ?? { inquiryCount: 0, salesAmount: 0 };
    return { monthKey: mk, inquiryCount: v.inquiryCount, salesAmount: v.salesAmount };
  });

  const byPreferredDate = [...preferredByYmd.entries()]
    .map(([date, inquiryCount]) => ({ date, inquiryCount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    monthKey,
    byServiceZone,
    byMonth,
    byPreferredDate,
  };
}
