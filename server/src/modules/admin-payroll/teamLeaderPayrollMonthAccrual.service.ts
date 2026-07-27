import type { PrismaClient } from '@prisma/client';
import type { TeamLeaderGeneralSettlementMode } from '@prisma/client';
import { kstMonthRangeYm } from '../inquiries/inquiryListDateRange.js';
import { compareMonthKey, nextMonthKey } from './marketerPayrollLedger.js';
import {
  loadMarketplaceBuyerRevenueMetaByInquiryId,
  resolvePayrollGeneralServiceAmount,
} from '../db-marketplace/dbMarketplaceRevenue.helpers.js';

/** 추가결재 회사 몫 미설정 시 정산 화면 기본(만분율 5000 = 50%) */
const DEFAULT_ADDITIONAL_COMPANY_SHARE_BPS = 5000;

export type TeamLeaderPayrollMonthAccrualCore = {
  /** 선택 귀속 월(KST) 안 예약일 · 해당 팀장 배정 · 취소 제외 접수 수 */
  assignedJobCount: number;
  /** 추가결재 금액이 1원이라도 있는 배정 접수 수 */
  additionalReceiptInquiryCount: number;
  /** 위 접수들의 `service_total_amount` 합(미입력은 0으로 합산) */
  generalSalesSum: number;
  /** 위 접수들의 추가결재 금액 합 */
  additionalSalesSum: number;
  /** 사용자 등록 일반 정산 규칙으로 산출한 당월 지급 예정(원). 규칙 미설정 시 null */
  settlementDueGeneral: number | null;
  /** 회사입금 추가결재 팀장 몫 가산 + 현장수금 추가결재 회사 몫 일당 차감을 반영한 순액 */
  settlementDueAdditional: number;
  /** 일반+추가 예정 합. 일반을 산출할 수 없으면 null */
  settlementDueTotal: number | null;
};

type InquiryAmt = { svc: number; addCompanyDepositSum: number; addFieldReceivedSum: number };

function splitAdditionalReceiptsForSettlement(
  receipts: { amount: number; settlementChannel: string }[],
): { addCompanyDepositSum: number; addFieldReceivedSum: number } {
  let addCompanyDepositSum = 0;
  let addFieldReceivedSum = 0;
  for (const r of receipts) {
    const a = Math.max(0, r.amount);
    if (r.settlementChannel === 'FIELD_RECEIVED') addFieldReceivedSum += a;
    else addCompanyDepositSum += a;
  }
  return { addCompanyDepositSum, addFieldReceivedSum };
}

export type LeaderProfile = {
  id: string;
  teamLeaderGeneralSettlementMode: TeamLeaderGeneralSettlementMode | null;
  teamLeaderGeneralSettlementValue: number | null;
  teamLeaderAdditionalReceiptCompanyShareBps: number | null;
};

export type LeaderProfileWithHire = LeaderProfile & { hireDate: Date | null };

function formatYmKst(d: Date): string {
  return d.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function hireMonthKeyOrDefault(hire: Date | null): string {
  if (!hire) return '2020-01';
  return hire.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 7);
}

function settlementDueTotalFromParts(general: number | null, additional: number): number | null {
  if (general == null) return null;
  return general + additional;
}

function computeSettlementDueForLeader(
  prof: LeaderProfile,
  inquiries: Map<string, InquiryAmt>,
): TeamLeaderPayrollMonthAccrualCore {
  let generalSalesSum = 0;
  let additionalSalesSum = 0;
  for (const q of inquiries.values()) {
    generalSalesSum += q.svc;
    additionalSalesSum += q.addCompanyDepositSum + q.addFieldReceivedSum;
  }

  const companyBpsRaw = prof.teamLeaderAdditionalReceiptCompanyShareBps;
  /** 프로필 「추가결재 회사 몫」만분율(0~10000). 예: 5000 = 회사 50% · 팀장 50%. */
  const companyBps =
    companyBpsRaw != null && companyBpsRaw >= 0 && companyBpsRaw <= 10000
      ? companyBpsRaw
      : DEFAULT_ADDITIONAL_COMPANY_SHARE_BPS;
  const leaderBps = Math.max(0, Math.min(10000, 10000 - companyBps));

  let settlementDueAdditional = 0;
  for (const q of inquiries.values()) {
    settlementDueAdditional += Math.floor((q.addCompanyDepositSum * leaderBps) / 10000);
    settlementDueAdditional -= Math.floor((q.addFieldReceivedSum * companyBps) / 10000);
  }

  const mode = prof.teamLeaderGeneralSettlementMode;
  const val = prof.teamLeaderGeneralSettlementValue;
  let settlementDueGeneral: number | null = null;
  if (mode === 'FIXED_PER_JOB_WON' && val != null && val >= 0) {
    settlementDueGeneral = inquiries.size * val;
  } else if (mode === 'PERCENT_OF_GENERAL_SERVICE_BPS' && val != null && val >= 0) {
    let sum = 0;
    for (const q of inquiries.values()) {
      sum += Math.floor((q.svc * val) / 10000);
    }
    settlementDueGeneral = sum;
  }

  let additionalReceiptInquiryCount = 0;
  for (const q of inquiries.values()) {
    if (q.addCompanyDepositSum + q.addFieldReceivedSum > 0) additionalReceiptInquiryCount += 1;
  }

  return {
    assignedJobCount: inquiries.size,
    additionalReceiptInquiryCount,
    generalSalesSum,
    additionalSalesSum,
    settlementDueGeneral,
    settlementDueAdditional,
    settlementDueTotal: settlementDueTotalFromParts(settlementDueGeneral, settlementDueAdditional),
  };
}

/**
 * 귀속 월(monthKey) 동안 예약일이 해당 월에 속하고, 팀장에게 배정된 접수를 모아
 * 매출·추가결재 매출·정산 규칙 기준 예상 지급(일반·추가)을 팀장별로 계산한다.
 */
export async function computeTeamLeaderPayrollMonthAccrualMap(
  prisma: PrismaClient,
  tenantId: string,
  monthKey: string,
  leaders: LeaderProfile[],
): Promise<Map<string, TeamLeaderPayrollMonthAccrualCore>> {
  const profileById = new Map(leaders.map((l) => [l.id, l]));
  const inquiriesByLeader = new Map<string, Map<string, InquiryAmt>>();
  for (const l of leaders) {
    inquiriesByLeader.set(l.id, new Map());
  }

  if (leaders.length === 0) return new Map();

  const range = kstMonthRangeYm(monthKey);
  if (!range) return new Map();

  const leaderIds = leaders.map((l) => l.id);

  type Row = {
    id: string;
    teamLeaderId: string;
    inquiryId: string;
    inquiry: {
      id: string;
      serviceTotalAmount: number | null;
      additionalReceipts: { amount: number; settlementChannel: string }[];
    };
  };

  const BATCH = 2500;
  let cursor: { id: string } | undefined;
  for (;;) {
    const batch: Row[] = await prisma.assignment.findMany({
      where: {
        teamLeaderId: { in: leaderIds },
        inquiry: {
          preferredDate: { not: null, gte: range.gte, lte: range.lte },
          status: { not: 'CANCELLED' },
        },
      },
      ...(cursor ? { cursor, skip: 1 } : {}),
      take: BATCH,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        teamLeaderId: true,
        inquiryId: true,
        inquiry: {
          select: {
            id: true,
            serviceTotalAmount: true,
            additionalReceipts: { select: { amount: true, settlementChannel: true } },
          },
        },
      },
    });
    if (batch.length === 0) break;

    const buyerMetaMap = await loadMarketplaceBuyerRevenueMetaByInquiryId(
      tenantId,
      batch.map((row) => row.inquiryId),
    );

    for (const row of batch) {
      const bucket = inquiriesByLeader.get(row.teamLeaderId);
      if (!bucket) continue;

      const inq = row.inquiry;
      const svc = resolvePayrollGeneralServiceAmount(
        inq.serviceTotalAmount,
        buyerMetaMap.get(inq.id),
      );
      const { addCompanyDepositSum, addFieldReceivedSum } = splitAdditionalReceiptsForSettlement(
        inq.additionalReceipts,
      );

      const prev = bucket.get(inq.id);
      if (!prev) {
        bucket.set(inq.id, { svc, addCompanyDepositSum, addFieldReceivedSum });
      }
    }

    cursor = { id: batch[batch.length - 1]!.id };
  }

  const out = new Map<string, TeamLeaderPayrollMonthAccrualCore>();
  for (const l of leaders) {
    const prof = profileById.get(l.id)!;
    const inquiries = inquiriesByLeader.get(l.id)!;
    out.set(l.id, computeSettlementDueForLeader(prof, inquiries));
  }

  return out;
}

export type TeamLeaderPayrollMonthAccrualWithPaid = TeamLeaderPayrollMonthAccrualCore & {
  paidGeneralSum: number;
  paidAdditionalSum: number;
  unsettledGeneral: number | null;
  unsettledAdditional: number;
  unsettledCombined: number;
};

export function attachPaidAndUnsettled(
  core: TeamLeaderPayrollMonthAccrualCore,
  paidGeneral: number,
  paidAdditional: number,
): TeamLeaderPayrollMonthAccrualWithPaid {
  const unsettledGeneral =
    core.settlementDueGeneral != null ? Math.max(0, core.settlementDueGeneral - paidGeneral) : null;
  /** 추가 버킷: 회사입금(팀장 몫 가산)·현장수금(회사 몫 차감) 순액 — 음수는 팀장이 회사에 더 내야 할 잔액 방향 */
  const unsettledAdditional = core.settlementDueAdditional - paidAdditional;
  const unsettledCombined = (unsettledGeneral ?? 0) + unsettledAdditional;
  return {
    ...core,
    paidGeneralSum: paidGeneral,
    paidAdditionalSum: paidAdditional,
    unsettledGeneral,
    unsettledAdditional,
    unsettledCombined,
  };
}

/**
 * 입사월(KST)부터 선택 귀속 월까지 — 각 달의 미정산(일반은 0 바닥, 추가는 부호 유지)을 합산한 누적치.
 */
export async function computeLeaderCumulativeUnsettledThroughMonth(
  prisma: PrismaClient,
  tenantId: string,
  endMonthKey: string,
  leaders: LeaderProfileWithHire[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>();
  if (leaders.length === 0) return result;

  const profileById = new Map(leaders.map((l) => [l.id, l]));
  const leaderIds = leaders.map((l) => l.id);

  let globalStart = hireMonthKeyOrDefault(leaders[0]!.hireDate);
  for (let i = 1; i < leaders.length; i++) {
    const hm = hireMonthKeyOrDefault(leaders[i]!.hireDate);
    if (compareMonthKey(hm, globalStart) < 0) globalStart = hm;
  }

  const startRange = kstMonthRangeYm(globalStart);
  const endRange = kstMonthRangeYm(endMonthKey);
  if (!startRange || !endRange) return result;

  type Row = {
    id: string;
    teamLeaderId: string;
    inquiryId: string;
    inquiry: {
      id: string;
      preferredDate: Date | null;
      serviceTotalAmount: number | null;
      additionalReceipts: { amount: number; settlementChannel: string }[];
    };
  };

  const nested = new Map<string, Map<string, Map<string, InquiryAmt>>>();
  for (const id of leaderIds) nested.set(id, new Map());

  const BATCH = 2500;
  let cursor: { id: string } | undefined;
  for (;;) {
    const batch: Row[] = await prisma.assignment.findMany({
      where: {
        teamLeaderId: { in: leaderIds },
        inquiry: {
          preferredDate: { not: null, gte: startRange.gte, lte: endRange.lte },
          status: { not: 'CANCELLED' },
        },
      },
      ...(cursor ? { cursor, skip: 1 } : {}),
      take: BATCH,
      orderBy: { id: 'asc' },
      select: {
        id: true,
        teamLeaderId: true,
        inquiryId: true,
        inquiry: {
          select: {
            id: true,
            preferredDate: true,
            serviceTotalAmount: true,
            additionalReceipts: { select: { amount: true, settlementChannel: true } },
          },
        },
      },
    });
    if (batch.length === 0) break;

    const buyerMetaMap = await loadMarketplaceBuyerRevenueMetaByInquiryId(
      tenantId,
      batch.map((row) => row.inquiryId),
    );

    for (const row of batch) {
      const pref = row.inquiry.preferredDate;
      if (!pref) continue;
      const mk = formatYmKst(pref);
      if (compareMonthKey(mk, globalStart) < 0 || compareMonthKey(mk, endMonthKey) > 0) continue;

      const leaderMonths = nested.get(row.teamLeaderId);
      if (!leaderMonths) continue;
      let monthMap = leaderMonths.get(mk);
      if (!monthMap) {
        monthMap = new Map();
        leaderMonths.set(mk, monthMap);
      }

      const inq = row.inquiry;
      const svc = resolvePayrollGeneralServiceAmount(
        inq.serviceTotalAmount,
        buyerMetaMap.get(inq.id),
      );
      const { addCompanyDepositSum, addFieldReceivedSum } = splitAdditionalReceiptsForSettlement(
        inq.additionalReceipts,
      );

      if (!monthMap.has(inq.id)) {
        monthMap.set(inq.id, { svc, addCompanyDepositSum, addFieldReceivedSum });
      }
    }

    cursor = { id: batch[batch.length - 1]!.id };
  }

  const payments = await prisma.teamLeaderPayrollPayment.findMany({
    where: {
      userId: { in: leaderIds },
      monthKey: { gte: globalStart, lte: endMonthKey },
    },
    select: {
      userId: true,
      monthKey: true,
      amount: true,
      settlementBucket: true,
    },
  });

  const payCell = new Map<string, { gen: number; add: number }>();
  for (const p of payments) {
    const key = `${p.userId}\t${p.monthKey}`;
    const cur = payCell.get(key) ?? { gen: 0, add: 0 };
    if (p.settlementBucket === 'ADDITIONAL_RECEIPT_SETTLEMENT') cur.add += p.amount;
    else cur.gen += p.amount;
    payCell.set(key, cur);
  }

  for (const l of leaders) {
    const prof = profileById.get(l.id);
    if (!prof) continue;

    let cum = 0;
    let mk = hireMonthKeyOrDefault(l.hireDate);
    if (compareMonthKey(mk, globalStart) < 0) mk = globalStart;

    while (compareMonthKey(mk, endMonthKey) <= 0) {
      const monthMap = nested.get(l.id)?.get(mk) ?? new Map();
      const core = computeSettlementDueForLeader(prof, monthMap);
      const pc = payCell.get(`${l.id}\t${mk}`) ?? { gen: 0, add: 0 };
      const full = attachPaidAndUnsettled(core, pc.gen, pc.add);
      cum += full.unsettledCombined;
      mk = nextMonthKey(mk);
    }

    result.set(l.id, cum);
  }

  return result;
}
