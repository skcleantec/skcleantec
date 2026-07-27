import { prisma } from '../../lib/prisma.js';
import { kstMonthRangeYm, kstTodayYmd } from '../inquiries/inquiryListDateRange.js';
import {
  attachPaidAndUnsettled,
  computeTeamLeaderPayrollMonthAccrualMap,
} from '../admin-payroll/teamLeaderPayrollMonthAccrual.service.js';
import { dateToYmdKst, employmentOverlapsMonthKst } from '../users/userEmployment.js';

export type DashboardSettlementSummaryRow = {
  teamLeaderId: string;
  name: string;
  assignedJobCount: number;
  settlementDueTotal: number | null;
  paidTotal: number;
  unsettledCombined: number;
};

export type DashboardSettlementSummary = {
  monthKey: string;
  rows: DashboardSettlementSummaryRow[];
  totals: {
    settlementDueTotal: number;
    paidTotal: number;
    unsettledCombined: number;
  };
};

function parseMonthKey(raw: string | undefined): string {
  const fallback = kstTodayYmd().slice(0, 7);
  if (!raw || !/^\d{4}-\d{2}$/.test(raw.trim())) return fallback;
  return raw.trim();
}

export async function buildDashboardSettlementSummary(
  tenantId: string,
  monthKeyRaw?: string,
): Promise<DashboardSettlementSummary> {
  const monthKey = parseMonthKey(monthKeyRaw);
  const range = kstMonthRangeYm(monthKey);
  if (!range) {
    throw new Error('정산 집계 월 구간을 계산할 수 없습니다.');
  }
  const monthStartYmd = dateToYmdKst(range.gte);
  const monthEndYmd = dateToYmdKst(range.lte);

  const teamLeaders = await prisma.user.findMany({
    where: { tenantId, role: 'TEAM_LEADER', isActive: true },
    select: {
      id: true,
      name: true,
      hireDate: true,
      resignationDate: true,
      teamLeaderGeneralSettlementMode: true,
      teamLeaderGeneralSettlementValue: true,
      teamLeaderAdditionalReceiptCompanyShareBps: true,
    },
    orderBy: { name: 'asc' },
  });

  const leadersForMonth = teamLeaders.filter((u) =>
    employmentOverlapsMonthKst(u.hireDate, u.resignationDate, monthStartYmd, monthEndYmd),
  );

  const leaderIds = leadersForMonth.map((u) => u.id);
  const payments =
    leaderIds.length === 0
      ? []
      : await prisma.teamLeaderPayrollPayment.findMany({
          where: { userId: { in: leaderIds }, monthKey },
          select: { userId: true, amount: true, settlementBucket: true },
        });

  const paidByLeader = new Map<string, { general: number; additional: number }>();
  for (const p of payments) {
    const cur = paidByLeader.get(p.userId) ?? { general: 0, additional: 0 };
    if (p.settlementBucket === 'ADDITIONAL_RECEIPT_SETTLEMENT') {
      cur.additional += p.amount;
    } else {
      cur.general += p.amount;
    }
    paidByLeader.set(p.userId, cur);
  }

  const profiles = leadersForMonth.map((u) => ({
    id: u.id,
    teamLeaderGeneralSettlementMode: u.teamLeaderGeneralSettlementMode ?? null,
    teamLeaderGeneralSettlementValue: u.teamLeaderGeneralSettlementValue ?? null,
    teamLeaderAdditionalReceiptCompanyShareBps: u.teamLeaderAdditionalReceiptCompanyShareBps ?? null,
  }));

  const accrualMap =
    profiles.length === 0
      ? new Map()
      : await computeTeamLeaderPayrollMonthAccrualMap(prisma, tenantId, monthKey, profiles);

  const rows: DashboardSettlementSummaryRow[] = [];
  let dueSum = 0;
  let paidSum = 0;
  let unsettledSum = 0;

  for (const tl of leadersForMonth) {
    const core = accrualMap.get(tl.id) ?? {
      assignedJobCount: 0,
      additionalReceiptInquiryCount: 0,
      generalSalesSum: 0,
      additionalSalesSum: 0,
      settlementDueGeneral: null,
      settlementDueAdditional: 0,
      settlementDueTotal: null,
    };
    const paid = paidByLeader.get(tl.id) ?? { general: 0, additional: 0 };
    const full = attachPaidAndUnsettled(core, paid.general, paid.additional);
    const paidTotal = paid.general + paid.additional;

    rows.push({
      teamLeaderId: tl.id,
      name: tl.name,
      assignedJobCount: full.assignedJobCount,
      settlementDueTotal: full.settlementDueTotal,
      paidTotal,
      unsettledCombined: full.unsettledCombined,
    });

    paidSum += paidTotal;
    unsettledSum += full.unsettledCombined;
    if (full.settlementDueTotal != null) dueSum += full.settlementDueTotal;
  }

  rows.sort((a, b) => Math.abs(b.unsettledCombined) - Math.abs(a.unsettledCombined) || a.name.localeCompare(b.name, 'ko'));

  return {
    monthKey,
    rows,
    totals: {
      settlementDueTotal: dueSum,
      paidTotal: paidSum,
      unsettledCombined: unsettledSum,
    },
  };
}
