import { prisma } from '../../lib/prisma.js';
import { kstMonthRangeYm, kstTodayYmd, kstYmdKeysInRange } from '../inquiries/inquiryListDateRange.js';
import {
  effectiveSalesDateYmd,
  getInquiryAmount,
  SALES_AMOUNT_STATUSES,
} from './dashboardSales.helpers.js';

export type DashboardSalesBreakdown = {
  monthKey: string;
  totalSales: number;
  inquiryCount: number;
  dailySales: Array<{ date: string; amount: number; inquiryCount: number }>;
  salesByTeamLeader: Array<{ teamLeaderId: string; name: string; amount: number }>;
};

function parseMonthKey(raw: string | undefined): string {
  const fallback = kstTodayYmd().slice(0, 7);
  if (!raw || !/^\d{4}-\d{2}$/.test(raw.trim())) return fallback;
  return raw.trim();
}

export async function buildDashboardSalesBreakdown(
  tenantId: string,
  monthKeyRaw?: string,
): Promise<DashboardSalesBreakdown> {
  const monthKey = parseMonthKey(monthKeyRaw);
  const range = kstMonthRangeYm(monthKey);
  if (!range) {
    throw new Error('매출 집계 월 구간을 계산할 수 없습니다.');
  }

  const monthLastDay = range.lte.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);

  const [estimateConfig, teamLeaders, inquiries] = await Promise.all([
    prisma.estimateConfig.findUnique({ where: { tenantId } }).then((c) => c?.pricePerPyeong ?? 5000),
    prisma.user.findMany({
      where: { tenantId, role: 'TEAM_LEADER', isActive: true },
      select: { id: true, name: true },
      orderBy: { name: 'asc' },
    }),
    prisma.inquiry.findMany({
      where: {
        tenantId,
        status: { in: [...SALES_AMOUNT_STATUSES] },
        createdAt: { gte: range.gte, lte: range.lte },
      },
      select: {
        createdAt: true,
        areaPyeong: true,
        serviceTotalAmount: true,
        orderForm: { select: { totalAmount: true } },
        extraCharges: { select: { amount: true } },
        assignments: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          select: { teamLeader: { select: { id: true, name: true } } },
        },
      },
    }),
  ]);

  const pricePerPyeong = estimateConfig;
  const dailyMap = new Map<string, { amount: number; inquiryCount: number }>();
  for (const ymd of kstYmdKeysInRange(`${monthKey}-01`, monthLastDay)) {
    dailyMap.set(ymd, { amount: 0, inquiryCount: 0 });
  }

  const salesByTeamLeaderMap = new Map<string, { teamLeaderId: string; name: string; amount: number }>(
    teamLeaders.map((tl) => [tl.id, { teamLeaderId: tl.id, name: tl.name, amount: 0 }]),
  );

  let totalSales = 0;
  let inquiryCount = 0;

  for (const inq of inquiries) {
    const ymd = effectiveSalesDateYmd(inq);
    if (!ymd.startsWith(monthKey)) continue;
    const amt = getInquiryAmount(inq, pricePerPyeong);
    inquiryCount += 1;
    totalSales += amt;

    const dayEntry = dailyMap.get(ymd);
    if (dayEntry) {
      dayEntry.amount += amt;
      dayEntry.inquiryCount += 1;
    }

    if (amt <= 0) continue;
    const assigned = inq.assignments?.[0]?.teamLeader;
    if (!assigned) continue;
    const tlEntry = salesByTeamLeaderMap.get(assigned.id);
    if (tlEntry) tlEntry.amount += amt;
  }

  const dailySales = [...dailyMap.entries()]
    .map(([date, v]) => ({ date, amount: v.amount, inquiryCount: v.inquiryCount }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const salesByTeamLeader = [...salesByTeamLeaderMap.values()]
    .filter((s) => s.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  return {
    monthKey,
    totalSales,
    inquiryCount,
    dailySales,
    salesByTeamLeader,
  };
}
