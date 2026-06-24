import { prisma } from '../../lib/prisma.js';
import { kstMonthRangeYm, kstTodayYmd, kstYmdKeysInRange } from '../inquiries/inquiryListDateRange.js';
import {
  listActiveServiceZoneRows,
  matchingServiceZonesForAddress,
  type ActiveServiceZoneRow,
} from '../service-zones/serviceZoneAssignment.js';
import {
  parseRegionLabelFromAddress,
  parseSidoFromAddress,
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

export type DashboardInquiryBreakdown = {
  monthKey: string;
  /** 시·군/시·도 주소 파싱 + (있으면) 서비스 권역명 우선 */
  byRegion: DashboardRegionBucket[];
  /** 시·도 지도 염색용 */
  bySidoMap: DashboardSidoMapBucket[];
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

function resolveInquiryRegion(
  address: string,
  zones: ActiveServiceZoneRow[],
): { regionKey: string; label: string; sidoKey: KoreaSidoKey | null } {
  const zoneMatches = matchingServiceZonesForAddress(address, zones);
  const sidoKey = parseSidoFromAddress(address);
  if (zoneMatches.length > 0) {
    const z = zoneMatches[0];
    return {
      regionKey: `zone:${z.id}`,
      label: z.name,
      sidoKey,
    };
  }
  const label = parseRegionLabelFromAddress(address);
  if (label === '미분류') {
    return { regionKey: 'unclassified', label, sidoKey: null };
  }
  const sigungu = label;
  if (sidoKey && shortSidoLabel(sidoKey) !== label && label.endsWith('시')) {
    return { regionKey: `city:${sidoKey}:${sigungu}`, label, sidoKey };
  }
  if (sidoKey) {
    return { regionKey: `sido:${sidoKey}`, label, sidoKey };
  }
  return { regionKey: `label:${label}`, label, sidoKey: null };
}

function parseAnchorMonthKey(raw: string | undefined): string {
  const todayYmd = kstTodayYmd();
  const fallback = todayYmd.slice(0, 7);
  if (!raw || !/^\d{4}-\d{2}$/.test(raw.trim())) return fallback;
  return raw.trim();
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

  const regionAgg = new Map<string, DashboardRegionBucket>();
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
      const { regionKey, label, sidoKey } = resolveInquiryRegion(inq.address, serviceZones);
      const regionEntry = regionAgg.get(regionKey) ?? {
        regionKey,
        label,
        sidoKey,
        inquiryCount: 0,
        salesAmount: 0,
      };
      regionEntry.inquiryCount += 1;
      regionEntry.salesAmount += amt;
      regionAgg.set(regionKey, regionEntry);

      if (sidoKey) {
        const sidoEntry = sidoAgg.get(sidoKey)!;
        sidoEntry.inquiryCount += 1;
        sidoEntry.salesAmount += amt;
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
    byMonth,
    byPreferredDate,
  };
}
