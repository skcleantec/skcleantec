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
  resolveInquiryCompanyRevenueAmount,
  SALES_AMOUNT_STATUSES,
} from './dashboardSales.helpers.js';
import { loadMarketplaceInquiryRevenueOverrideMap } from '../db-marketplace/dbMarketplaceRevenue.helpers.js';

export type DashboardRegionDateBasis = 'createdAt' | 'preferredDate';

export type DashboardRegionBucket = {
  regionKey: string;
  label: string;
  sidoKey: string | null;
  inquiryCount: number;
  salesAmount: number;
  /** 도내 시·군 하위 구 (예: 수원시 → 영통구) */
  children?: DashboardRegionBucket[];
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

export type DashboardRegionAnalytics = {
  byRegion: DashboardRegionBucket[];
  bySidoMap: DashboardSidoMapBucket[];
  byRegionWithinSido: DashboardSidoRegionDetail[];
};

export type DashboardInquiryBreakdown = {
  monthKey: string;
  regionByDateBasis: Record<DashboardRegionDateBasis, DashboardRegionAnalytics>;
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
  id: string;
  createdAt: Date;
  address: string;
  areaPyeong: number | null;
  serviceTotalAmount: number | null;
  preferredDate: Date | null;
  status: string;
  orderForm: { totalAmount: number } | null;
  extraCharges: { amount: number }[];
};

type RegionAggState = {
  regionAgg: Map<string, DashboardRegionBucket>;
  sidoAgg: Map<KoreaSidoKey, DashboardSidoMapBucket>;
  /** 광역시·특별시: 구 flat */
  metroSub: Map<KoreaSidoKey, Map<string, DashboardRegionBucket>>;
  /** 도: 시·군 → (optional) 구 children */
  provincialCity: Map<KoreaSidoKey, Map<string, { bucket: DashboardRegionBucket; gu: Map<string, DashboardRegionBucket> }>>;
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

function createRegionAggState(): RegionAggState {
  const sidoAgg = new Map<KoreaSidoKey, DashboardSidoMapBucket>();
  for (const sk of KOREA_SIDO_KEYS) {
    sidoAgg.set(sk, {
      sidoKey: sk,
      label: shortSidoLabel(sk),
      inquiryCount: 0,
      salesAmount: 0,
    });
  }
  return {
    regionAgg: new Map(),
    sidoAgg,
    metroSub: new Map(),
    provincialCity: new Map(),
  };
}

function isSalesStatus(status: string): boolean {
  return (SALES_AMOUNT_STATUSES as readonly string[]).includes(status);
}

function isPreferredRegionStatus(status: string): boolean {
  return status !== 'CANCELLED' && status !== 'ON_HOLD';
}

function bumpRegionAnalytics(state: RegionAggState, address: string, delta: number, amt: number): void {
  const parsed = parseDashboardRegionFromAddress(address);
  bumpBucket(state.regionAgg, parsed.chartRegionKey, parsed.chartLabel, parsed.sidoKey, delta, amt);

  if (!parsed.sidoKey) return;

  const sidoEntry = state.sidoAgg.get(parsed.sidoKey)!;
  sidoEntry.inquiryCount += delta;
  sidoEntry.salesAmount += amt;

  const isMetroGu = parsed.subRegionKey.startsWith('gu:') && parsed.parentCityKey == null;
  if (isMetroGu) {
    let subMap = state.metroSub.get(parsed.sidoKey);
    if (!subMap) {
      subMap = new Map();
      state.metroSub.set(parsed.sidoKey, subMap);
    }
    bumpBucket(subMap, parsed.subRegionKey, parsed.subLabel, parsed.sidoKey, delta, amt);
    return;
  }

  let cityMap = state.provincialCity.get(parsed.sidoKey);
  if (!cityMap) {
    cityMap = new Map();
    state.provincialCity.set(parsed.sidoKey, cityMap);
  }

  let cityEntry = cityMap.get(parsed.subRegionKey);
  if (!cityEntry) {
    cityEntry = {
      bucket: {
        regionKey: parsed.subRegionKey,
        label: parsed.subLabel,
        sidoKey: parsed.sidoKey,
        inquiryCount: 0,
        salesAmount: 0,
      },
      gu: new Map(),
    };
    cityMap.set(parsed.subRegionKey, cityEntry);
  }
  cityEntry.bucket.inquiryCount += delta;
  cityEntry.bucket.salesAmount += amt;

  if (parsed.districtRegionKey && parsed.districtLabel && parsed.parentCityKey) {
    bumpBucket(cityEntry.gu, parsed.districtRegionKey, parsed.districtLabel, parsed.sidoKey, delta, amt);
  }
}

function finalizeRegionAnalytics(state: RegionAggState): DashboardRegionAnalytics {
  const byRegion = [...state.regionAgg.values()]
    .filter((z) => z.inquiryCount > 0)
    .sort((a, b) => b.inquiryCount - a.inquiryCount || a.label.localeCompare(b.label, 'ko'));

  const bySidoMap = [...state.sidoAgg.values()].filter((s) => s.inquiryCount > 0);

  const sidoKeys = new Set<KoreaSidoKey>([
    ...state.metroSub.keys(),
    ...state.provincialCity.keys(),
  ]);

  const byRegionWithinSido: DashboardSidoRegionDetail[] = [...sidoKeys]
    .map((sidoKey) => {
      const metroItems = state.metroSub.get(sidoKey);
      if (metroItems) {
        return {
          sidoKey,
          label: shortSidoLabel(sidoKey),
          items: [...metroItems.values()]
            .filter((z) => z.inquiryCount > 0)
            .sort((a, b) => b.inquiryCount - a.inquiryCount || a.label.localeCompare(b.label, 'ko')),
        };
      }

      const cityMap = state.provincialCity.get(sidoKey)!;
      const items = [...cityMap.values()]
        .map(({ bucket, gu }) => {
          const children = [...gu.values()]
            .filter((z) => z.inquiryCount > 0)
            .sort((a, b) => b.inquiryCount - a.inquiryCount || a.label.localeCompare(b.label, 'ko'));
          return children.length > 0 ? { ...bucket, children } : bucket;
        })
        .filter((z) => z.inquiryCount > 0)
        .sort((a, b) => b.inquiryCount - a.inquiryCount || a.label.localeCompare(b.label, 'ko'));

      return { sidoKey, label: shortSidoLabel(sidoKey), items };
    })
    .filter((g) => g.items.length > 0)
    .sort((a, b) => {
      const aTotal = a.items.reduce((s, i) => s + i.inquiryCount, 0);
      const bTotal = b.items.reduce((s, i) => s + i.inquiryCount, 0);
      return bTotal - aTotal || a.label.localeCompare(b.label, 'ko');
    });

  return { byRegion, bySidoMap, byRegionWithinSido };
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

  const [estimateConfig, inquiries, preferredInquiries] = await Promise.all([
    prisma.estimateConfig.findUnique({ where: { tenantId } }).then((c) => c?.pricePerPyeong ?? 5000),
    prisma.inquiry.findMany({
      where: {
        tenantId,
        OR: [
          {
            status: { in: [...SALES_AMOUNT_STATUSES] },
            createdAt: { gte: earliestRange.gte, lte: kstThisMonth.lte },
          },
          {
            status: { notIn: ['CANCELLED', 'ON_HOLD'] },
            preferredDate: { gte: kstThisMonth.gte, lte: kstThisMonth.lte },
          },
        ],
      },
      select: {
        id: true,
        createdAt: true,
        address: true,
        areaPyeong: true,
        serviceTotalAmount: true,
        preferredDate: true,
        status: true,
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

  const revenueOverrideMap = await loadMarketplaceInquiryRevenueOverrideMap(
    tenantId,
    inquiries.map((inq) => inq.id),
  );

  const regionCreatedAt = createRegionAggState();
  const regionPreferred = createRegionAggState();

  const monthAgg = new Map<string, { inquiryCount: number; salesAmount: number }>();
  for (const mk of monthKeys) {
    monthAgg.set(mk, { inquiryCount: 0, salesAmount: 0 });
  }

  for (const inq of inquiries as InquirySalesRow[]) {
    const createdYmd = effectiveSalesDateYmd(inq);
    const createdMk = createdYmd.slice(0, 7);
    const amt = resolveInquiryCompanyRevenueAmount(
      inq,
      pricePerPyeong,
      revenueOverrideMap.get(inq.id)?.amount,
    );

    if (isSalesStatus(inq.status) && monthAgg.has(createdMk)) {
      const cur = monthAgg.get(createdMk)!;
      cur.inquiryCount += 1;
      cur.salesAmount += amt;
    }

    if (isSalesStatus(inq.status) && createdMk === monthKey) {
      bumpRegionAnalytics(regionCreatedAt, inq.address, 1, amt);
    }

    if (inq.preferredDate && isPreferredRegionStatus(inq.status)) {
      const prefYmd = preferredDateYmd(inq.preferredDate);
      if (prefYmd.slice(0, 7) === monthKey) {
        bumpRegionAnalytics(regionPreferred, inq.address, 1, amt);
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

  const byMonth = monthKeys.map((mk) => {
    const v = monthAgg.get(mk) ?? { inquiryCount: 0, salesAmount: 0 };
    return { monthKey: mk, inquiryCount: v.inquiryCount, salesAmount: v.salesAmount };
  });

  const byPreferredDate = [...preferredByYmd.entries()]
    .map(([date, inquiryCount]) => ({ date, inquiryCount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    monthKey,
    regionByDateBasis: {
      createdAt: finalizeRegionAnalytics(regionCreatedAt),
      preferredDate: finalizeRegionAnalytics(regionPreferred),
    },
    byMonth,
    byPreferredDate,
  };
}
