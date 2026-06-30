import { prisma } from '../../lib/prisma.js';
import { kstMonthRangeYm, kstTodayYmd, kstYmdKeysInRange } from '../inquiries/inquiryListDateRange.js';
import {
  parseDashboardRegionFromAddress,
  shortSidoLabel,
  type KoreaSidoKey,
  KOREA_SIDO_KEYS,
} from '../../lib/regionMatch.js';
import {
  effectiveSalesDateYmd,
  getInquiryAmount,
  kstRecentMonthKeys,
  preferredDateYmd,
  SALES_AMOUNT_STATUSES,
} from './dashboardSales.helpers.js';

export type DashboardRegionBucket = {
  regionKey: string;
  label: string;
  sidoKey: string | null;
  inquiryCount: number;
  salesAmount: number;
};

export type DashboardSidoMapBucket = {
  sidoKey: KoreaSidoKey;
  label: string;
  inquiryCount: number;
  salesAmount: number;
};

export type DashboardSidoRegionDetail = {
  sidoKey: KoreaSidoKey;
  label: string;
  items: DashboardRegionBucket[];
};

export type DashboardInquiryBreakdown = {
  monthKey: string;
  /** 접수 주소 파싱 · 시·군·광역시·도 동급 비교 */
  byRegion: DashboardRegionBucket[];
  /** 시·도 지도 염색용 */
  bySidoMap: DashboardSidoMapBucket[];
  /** 시·도 클릭 시 구·군·시 상세 */
  byRegionWithinSido: DashboardSidoRegionDetail[];
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

function parseAnchorMonthKey(raw: string | undefined): string {
  const todayYmd = kstTodayYmd();
  const fallback = todayYmd.slice(0, 7);
  if (!raw || !/^\d{4}-\d{2}$/.test(raw.trim())) return fallback;
  return raw.trim();
}

function bumpBucket(
  map: Map<string, DashboardRegionBucket>,
  regionKey: string,
  label: string,
  sidoKey: KoreaSidoKey | null,
  inquiryDelta: number,
  salesDelta: number,
): void {
  const entry = map.get(regionKey) ?? {
    regionKey,
    label,
    sidoKey,
    inquiryCount: 0,
    salesAmount: 0,
  };
  entry.inquiryCount += inquiryDelta;
  entry.salesAmount += salesDelta;
  map.set(regionKey, entry);
}

export async function buildDashboardInquiryBreakdown(
  tenantId: string,
  anchorMonthKeyRaw?: string,
): Promise<DashboardInquiryBreakdown> {
  const monthKey = parseAnchorMonthKey(anchorMonthKeyRaw);
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

  const [estimateConfig, salesInquiries, preferredInquiries] = await Promise.all([
    prisma.estimateConfig.findUnique({ where: { tenantId } }).then((c) => c?.pricePerPyeong ?? 5000),
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

  const regionAgg = new Map<string, DashboardRegionBucket>();
  const sidoDetailAgg = new Map<KoreaSidoKey, Map<string, DashboardRegionBucket>>();
  const sidoAgg = new Map<KoreaSidoKey, DashboardSidoMapBucket>();
  for (const sk of KOREA_SIDO_KEYS) {
    sidoAgg.set(sk, {
      sidoKey: sk,
      label: shortSidoLabel(sk),
      inquiryCount: 0,
      salesAmount: 0,
    });
  }

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
      const parsed = parseDashboardRegionFromAddress(inq.address);
      bumpBucket(regionAgg, parsed.chartRegionKey, parsed.chartLabel, parsed.sidoKey, 1, amt);

      if (parsed.sidoKey) {
        const sidoEntry = sidoAgg.get(parsed.sidoKey)!;
        sidoEntry.inquiryCount += 1;
        sidoEntry.salesAmount += amt;

        let subMap = sidoDetailAgg.get(parsed.sidoKey);
        if (!subMap) {
          subMap = new Map();
          sidoDetailAgg.set(parsed.sidoKey, subMap);
        }
        bumpBucket(subMap, parsed.subRegionKey, parsed.subLabel, parsed.sidoKey, 1, amt);
      }
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

  const byRegion = [...regionAgg.values()]
    .filter((z) => z.inquiryCount > 0)
    .sort((a, b) => b.inquiryCount - a.inquiryCount || a.label.localeCompare(b.label, 'ko'));

  const bySidoMap = [...sidoAgg.values()].filter((s) => s.inquiryCount > 0);

  const byRegionWithinSido = [...sidoDetailAgg.entries()]
    .map(([sidoKey, subMap]) => ({
      sidoKey,
      label: shortSidoLabel(sidoKey),
      items: [...subMap.values()]
        .filter((z) => z.inquiryCount > 0)
        .sort((a, b) => b.inquiryCount - a.inquiryCount || a.label.localeCompare(b.label, 'ko')),
    }))
    .filter((g) => g.items.length > 0)
    .sort((a, b) => {
      const aTotal = a.items.reduce((s, i) => s + i.inquiryCount, 0);
      const bTotal = b.items.reduce((s, i) => s + i.inquiryCount, 0);
      return bTotal - aTotal || a.label.localeCompare(b.label, 'ko');
    });

  const byMonth = monthKeys.map((mk) => {
    const v = monthAgg.get(mk) ?? { inquiryCount: 0, salesAmount: 0 };
    return { monthKey: mk, inquiryCount: v.inquiryCount, salesAmount: v.salesAmount };
  });

  const byPreferredDate = [...preferredByYmd.entries()]
    .map(([date, inquiryCount]) => ({ date, inquiryCount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    monthKey,
    byRegion,
    bySidoMap,
    byRegionWithinSido,
    byMonth,
    byPreferredDate,
  };
}
