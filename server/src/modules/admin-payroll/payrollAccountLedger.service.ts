import type { PrismaClient } from '@prisma/client';
import { InquiryStatus, PayrollAccountLedgerManualDirection, PayrollLedgerManualPayrollLinkKind } from '@prisma/client';
import { kstMonthRangeYm } from '../inquiries/inquiryListDateRange.js';
import { dateToYmdKst } from '../users/userEmployment.js';

export type PayrollAccountLedgerEntryKind = 'cash' | 'accrual';

export type PayrollAccountLedgerLine = {
  id: string;
  occurredAt: string;
  dateYmd: string;
  direction: 'in' | 'out';
  amount: number;
  category: string;
  summary: string;
  memo: string | null;
  sourceType: string;
  entryKind: PayrollAccountLedgerEntryKind;
  runningAll: number;
  runningCash: number;
};

function monthLabelFromKey(monthKey: string): string {
  const [ys, ms] = monthKey.split('-');
  const y = parseInt(ys, 10);
  const m = parseInt(ms, 10);
  if (!Number.isFinite(y) || !Number.isFinite(m)) return monthKey;
  return `${y}년 ${m}월`;
}

/** @db.Date → YYYY-MM-DD */
function dateDbDateToYmd(d: Date): string {
  const y = d.getUTCFullYear();
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${mo}-${day}`;
}

function kstEndOfDayIso(ymd: string): string {
  return new Date(`${ymd}T23:59:59.999+09:00`).toISOString();
}

type LineDraft = Omit<PayrollAccountLedgerLine, 'runningAll' | 'runningCash'>;

export async function buildPayrollAccountLedger(
  prisma: PrismaClient,
  tenantId: string,
  monthKey: string,
): Promise<{
  month: string;
  monthLabel: string;
  lines: PayrollAccountLedgerLine[];
  totals: {
    cashIn: number;
    cashOut: number;
    cashNet: number;
    accrualIn: number;
    allNet: number;
  };
}> {
  const range = kstMonthRangeYm(monthKey);
  if (!range) {
    throw new Error('INVALID_MONTH');
  }

  const statusWhere = {
    tenantId,
    preferredDate: { gte: range.gte, lte: range.lte },
    status: { notIn: [InquiryStatus.CANCELLED, InquiryStatus.ON_HOLD] },
  };

  const [
    deposits,
    externals,
    personal,
    shared,
    crew,
    leaderPays,
    poolSettles,
    marketerSettles,
    inquiryRows,
    manualLedgerEntries,
  ] = await Promise.all([
    prisma.payrollIncomeDeposit.findMany({
      where: { tenantId, monthKey },
      orderBy: [{ depositedOn: 'asc' }, { createdAt: 'asc' }],
    }),
    prisma.externalCompanySettlementPayment.findMany({
      where: {
        paidAt: { gte: range.gte, lte: range.lte },
        externalCompany: { tenantId },
      },
      orderBy: [{ paidAt: 'asc' }, { id: 'asc' }],
      include: { externalCompany: { select: { name: true } } },
    }),
    prisma.payrollAdminPersonalExpense.findMany({
      where: { tenantId, monthKey },
      orderBy: [{ createdAt: 'asc' }],
    }),
    prisma.payrollAdminSharedExpense.findMany({
      where: { tenantId, monthKey },
      orderBy: [{ createdAt: 'asc' }],
    }),
    prisma.teamCrewGroupExpense.findMany({
      where: { monthKey, group: { tenantId } },
      orderBy: [{ createdAt: 'asc' }],
      include: {
        teamMember: { select: { name: true } },
        group: { select: { name: true } },
      },
    }),
    prisma.teamLeaderPayrollPayment.findMany({
      where: { monthKey, user: { tenantId } },
      orderBy: [{ paidOn: 'asc' }, { createdAt: 'asc' }],
      include: { user: { select: { name: true } } },
    }),
    prisma.teamMemberPayrollSettlement.findMany({
      where: {
        monthKey,
        OR: [
          { teamMember: { team: { tenantId } } },
          { teamMember: { crewGroupMembers: { some: { group: { tenantId } } } } },
        ],
      },
      orderBy: [{ settledAt: 'asc' }],
      include: { teamMember: { select: { name: true } } },
    }),
    prisma.marketerPayrollSettlement.findMany({
      where: { monthKey, user: { tenantId } },
      orderBy: [{ settledAt: 'asc' }],
      include: { user: { select: { name: true } } },
    }),
    prisma.inquiry.findMany({
      where: {
        ...statusWhere,
        serviceTotalAmount: { not: null },
      },
      select: { preferredDate: true, serviceTotalAmount: true },
    }),
    prisma.payrollAccountLedgerManualEntry.findMany({
      where: { tenantId, monthKey },
      orderBy: [{ occurredOn: 'asc' }, { createdAt: 'asc' }],
      include: {
        linkTeamMember: { select: { name: true } },
        linkUser: { select: { name: true } },
        linkExternalCompany: { select: { name: true } },
      },
    }),
  ]);

  const drafts: LineDraft[] = [];

  for (const d of deposits) {
    const dateYmd = dateDbDateToYmd(d.depositedOn);
    drafts.push({
      id: `income_deposit:${d.id}`,
      occurredAt: d.createdAt.toISOString(),
      dateYmd,
      direction: 'in',
      amount: d.amount,
      category: '실입금 등록',
      summary: d.memo?.trim() ? d.memo.trim() : '계좌 입금(등록)',
      memo: d.memo,
      sourceType: 'income_deposit',
      entryKind: 'cash',
    });
  }

  for (const r of externals) {
    const dateYmd = dateToYmdKst(r.paidAt);
    drafts.push({
      id: `external_settlement:${r.id}`,
      occurredAt: r.paidAt.toISOString(),
      dateYmd,
      direction: 'in',
      amount: r.amount,
      category: '타업체 정산 입금',
      summary: r.externalCompany.name,
      memo: r.memo,
      sourceType: 'external_settlement',
      entryKind: 'cash',
    });
  }

  for (const e of personal) {
    const dateYmd = dateToYmdKst(e.createdAt);
    drafts.push({
      id: `admin_personal:${e.id}`,
      occurredAt: e.createdAt.toISOString(),
      dateYmd,
      direction: 'out',
      amount: e.amount,
      category: '관리자 지출(개인)',
      summary: e.memo?.trim() ? e.memo.trim() : '개인·업무 지출',
      memo: e.memo,
      sourceType: 'admin_personal_expense',
      entryKind: 'cash',
    });
  }

  for (const e of shared) {
    const dateYmd = dateToYmdKst(e.createdAt);
    drafts.push({
      id: `admin_shared:${e.id}`,
      occurredAt: e.createdAt.toISOString(),
      dateYmd,
      direction: 'out',
      amount: e.amount,
      category: '관리자 지출(공용)',
      summary: e.memo?.trim() ? e.memo.trim() : '공용·부서 지출',
      memo: e.memo,
      sourceType: 'admin_shared_expense',
      entryKind: 'cash',
    });
  }

  for (const c of crew) {
    const dateYmd = dateToYmdKst(c.createdAt);
    const g = c.group.name;
    const mem = c.teamMember.name;
    drafts.push({
      id: `crew_expense:${c.id}`,
      occurredAt: c.createdAt.toISOString(),
      dateYmd,
      direction: 'out',
      amount: c.amount,
      category: '크루 지출 등록',
      summary: `${g} · ${mem}`,
      memo: c.memo,
      sourceType: 'crew_expense',
      entryKind: 'cash',
    });
  }

  for (const p of leaderPays) {
    const dateYmd = dateDbDateToYmd(p.paidOn);
    const bucketHint =
      p.settlementBucket === 'ADDITIONAL_RECEIPT_SETTLEMENT' ? ' (추가결재 정산)' : '';
    drafts.push({
      id: `team_leader_pay:${p.id}`,
      occurredAt: p.createdAt.toISOString(),
      dateYmd,
      direction: 'out',
      amount: p.amount,
      category: '팀장 급여 지급',
      summary: `${p.user.name}${bucketHint}`,
      memo: p.memo,
      sourceType: 'team_leader_payment',
      entryKind: 'cash',
    });
  }

  for (const s of poolSettles) {
    const dateYmd = dateToYmdKst(s.settledAt);
    drafts.push({
      id: `pool_settlement:${s.id}`,
      occurredAt: s.settledAt.toISOString(),
      dateYmd,
      direction: 'out',
      amount: s.amount,
      category: '현장 팀원 정산 지급',
      summary: s.teamMember.name,
      memo: null,
      sourceType: 'pool_settlement',
      entryKind: 'cash',
    });
  }

  for (const s of marketerSettles) {
    const dateYmd = dateToYmdKst(s.settledAt);
    const memoParts = [s.user.name];
    if (s.memo?.trim()) memoParts.push(s.memo.trim());
    drafts.push({
      id: `marketer_settlement:${s.id}`,
      occurredAt: s.settledAt.toISOString(),
      dateYmd,
      direction: 'out',
      amount: s.settledAmount,
      category: '마케터 정산 지급',
      summary: memoParts.join(' · '),
      memo: s.memo,
      sourceType: 'marketer_settlement',
      entryKind: 'cash',
    });
  }

  for (const me of manualLedgerEntries) {
    const dateYmd = dateDbDateToYmd(me.occurredOn);
    const dir = me.direction === PayrollAccountLedgerManualDirection.IN ? 'in' : 'out';
    let linkHint = '';
    if (dir === 'out' && me.payrollLinkKind !== PayrollLedgerManualPayrollLinkKind.NONE) {
      if (me.payrollLinkKind === PayrollLedgerManualPayrollLinkKind.POOL_MEMBER && me.linkTeamMember) {
        linkHint = ` · 현장 ${me.linkTeamMember.name}`;
      } else if (me.payrollLinkKind === PayrollLedgerManualPayrollLinkKind.TEAM_LEADER && me.linkUser) {
        linkHint = ` · 팀장 ${me.linkUser.name}`;
      } else if (me.payrollLinkKind === PayrollLedgerManualPayrollLinkKind.MARKETER && me.linkUser) {
        linkHint = ` · 마케터 ${me.linkUser.name}`;
      } else if (
        me.payrollLinkKind === PayrollLedgerManualPayrollLinkKind.EXTERNAL_COMPANY &&
        me.linkExternalCompany
      ) {
        linkHint = ` · 타업체 ${me.linkExternalCompany.name}`;
      }
    }
    drafts.push({
      id: `ledger_manual:${me.id}`,
      occurredAt: me.createdAt.toISOString(),
      dateYmd,
      direction: dir,
      amount: me.amount,
      category: dir === 'in' ? '수기 수입' : '수기 지출',
      summary: `${me.accountLabel}${linkHint}`,
      memo: me.memo,
      sourceType: 'ledger_manual',
      entryKind: 'cash',
    });
  }

  const salesByDay = new Map<string, number>();
  for (const q of inquiryRows) {
    const amt = q.serviceTotalAmount;
    if (amt == null || !Number.isFinite(amt) || q.preferredDate == null) continue;
    const ymd = dateToYmdKst(q.preferredDate);
    salesByDay.set(ymd, (salesByDay.get(ymd) ?? 0) + amt);
  }
  for (const ymd of [...salesByDay.keys()].sort((a, b) => a.localeCompare(b))) {
    const sum = salesByDay.get(ymd) ?? 0;
    if (sum <= 0) continue;
    drafts.push({
      id: `inquiry_service_total:${monthKey}:${ymd}`,
      occurredAt: kstEndOfDayIso(ymd),
      dateYmd: ymd,
      direction: 'in',
      amount: sum,
      category: '접수 매출(예약일)',
      summary: `${ymd} 미확정 입금·청구 합계(총액)`,
      memo: null,
      sourceType: 'inquiry_service_day',
      entryKind: 'accrual',
    });
  }

  drafts.sort((a, b) => {
    const c0 = a.dateYmd.localeCompare(b.dateYmd);
    if (c0 !== 0) return c0;
    const c1 = a.occurredAt.localeCompare(b.occurredAt);
    if (c1 !== 0) return c1;
    if (a.direction !== b.direction) return a.direction === 'in' ? -1 : 1;
    return a.id.localeCompare(b.id);
  });

  let runAll = 0;
  let runCash = 0;
  let cashIn = 0;
  let cashOut = 0;
  let accrualIn = 0;

  const lines: PayrollAccountLedgerLine[] = drafts.map((d) => {
    const delta = d.direction === 'in' ? d.amount : -d.amount;
    runAll += delta;
    if (d.entryKind === 'cash') {
      runCash += delta;
      if (d.direction === 'in') cashIn += d.amount;
      else cashOut += d.amount;
    } else if (d.direction === 'in') {
      accrualIn += d.amount;
    }
    return { ...d, runningAll: runAll, runningCash: runCash };
  });

  return {
    month: monthKey,
    monthLabel: monthLabelFromKey(monthKey),
    lines,
    totals: {
      cashIn,
      cashOut,
      cashNet: cashIn - cashOut,
      accrualIn,
      allNet: cashIn - cashOut + accrualIn,
    },
  };
}
