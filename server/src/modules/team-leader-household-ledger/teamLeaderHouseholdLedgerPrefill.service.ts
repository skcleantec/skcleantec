import type { PrismaClient } from '@prisma/client';
import type { TeamLeaderHouseholdPrefillKind } from './teamLeaderHouseholdLedger.constants.js';
import {
  type HouseholdLedgerPrefillOption,
  prefillLabel,
} from './teamLeaderHouseholdLedger.serialize.js';

export const DEFAULT_ADDITIONAL_COMPANY_SHARE_BPS = 5000;

export class HouseholdLedgerAccessError extends Error {
  constructor(
    message: string,
    readonly status = 403,
  ) {
    super(message);
    this.name = 'HouseholdLedgerAccessError';
  }
}

function coerceWon(v: unknown): number {
  if (v == null || v === '') return 0;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

function effectiveInquiryAmounts(inquiry: {
  serviceTotalAmount: number | null;
  serviceDepositAmount: number | null;
  serviceBalanceAmount: number | null;
  orderForm: {
    totalAmount: number | null;
    depositAmount: number | null;
    balanceAmount: number | null;
  } | null;
}) {
  return {
    total: inquiry.serviceTotalAmount ?? inquiry.orderForm?.totalAmount ?? null,
    deposit: inquiry.serviceDepositAmount ?? inquiry.orderForm?.depositAmount ?? null,
    balance: inquiry.serviceBalanceAmount ?? inquiry.orderForm?.balanceAmount ?? null,
  };
}

export function inquiryDefaultOccurredOn(inquiry: {
  preferredDate: Date | null;
  createdAt: Date;
}): Date {
  if (inquiry.preferredDate) {
    const ymd = inquiry.preferredDate.toISOString().slice(0, 10);
    return new Date(`${ymd}T12:00:00+09:00`);
  }
  const ymd = inquiry.createdAt.toLocaleString('sv-SE', { timeZone: 'Asia/Seoul' }).slice(0, 10);
  return new Date(`${ymd}T12:00:00+09:00`);
}

export type InquiryPrefillSource = {
  id: string;
  inquiryNumber: string | null;
  customerName: string;
  preferredDate: Date | null;
  createdAt: Date;
  serviceTotalAmount: number | null;
  serviceDepositAmount: number | null;
  serviceBalanceAmount: number | null;
  orderForm: {
    totalAmount: number | null;
    depositAmount: number | null;
    balanceAmount: number | null;
  } | null;
  additionalReceipts: Array<{ amount: number; settlementChannel: string; description: string }>;
  dbListing: {
    feeLedgers: Array<{ feeAmount: number; buyerTenantId: string }>;
  } | null;
};

export function buildPrefillItemsForInquiry(
  inquiry: InquiryPrefillSource,
  tenantId: string,
  teamBps: number,
  opts?: { depositAsTeamIncome?: boolean },
): { suggestedOccurredOn: Date; items: HouseholdLedgerPrefillOption[] } {
  const amounts = effectiveInquiryAmounts(inquiry);
  const suggestedOccurredOn = inquiryDefaultOccurredOn(inquiry);
  const depositAsTeamIncome = opts?.depositAsTeamIncome === true;

  const items: HouseholdLedgerPrefillOption[] = [];
  const push = (
    kind: TeamLeaderHouseholdPrefillKind,
    direction: 'INCOME' | 'EXPENSE',
    category: string,
    amount: number | null | undefined,
    memoHint: string | null,
  ) => {
    const n = amount != null ? Math.max(0, Math.round(amount)) : 0;
    if (n <= 0) return;
    items.push({
      kind,
      direction,
      category,
      amount: n,
      label: prefillLabel(kind),
      memoHint,
    });
  };

  if (depositAsTeamIncome) {
    push('deposit', 'INCOME', '예약금', amounts.deposit, `${inquiry.customerName} · 예약금`);
  }
  push('balance', 'INCOME', '잔금', amounts.balance, `${inquiry.customerName} · 잔금`);
  push('total', 'INCOME', '기타 수입', amounts.total, `${inquiry.customerName} · 총액 참고`);

  let addCompanyTeamSum = 0;
  let addFieldSum = 0;
  for (const r of inquiry.additionalReceipts) {
    const amt = Math.max(0, coerceWon(r.amount));
    if (r.settlementChannel === 'FIELD_RECEIVED') {
      addFieldSum += amt;
    } else {
      addCompanyTeamSum += Math.round((amt * teamBps) / 10000);
    }
  }
  if (addCompanyTeamSum > 0) {
    push(
      'additional_receipt_team',
      'INCOME',
      '추가결재(회사입금)',
      addCompanyTeamSum,
      `${inquiry.customerName} · 추가결재 팀장 몫`,
    );
  }
  if (addFieldSum > 0) {
    push(
      'additional_receipt_field',
      'INCOME',
      '추가결재(현장)',
      addFieldSum,
      `${inquiry.customerName} · 현장 수금`,
    );
  }

  const dbFee = inquiry.dbListing?.feeLedgers.find((f) => f.buyerTenantId === tenantId)?.feeAmount;
  push('db_purchase', 'EXPENSE', 'DB 구입', dbFee, `${inquiry.customerName} · DB 구입비`);

  return { suggestedOccurredOn, items };
}

export async function assertTeamLeaderCanAccessInquiry(
  db: PrismaClient,
  tenantId: string,
  teamLeaderId: string,
  inquiryId: string,
): Promise<void> {
  const row = await db.inquiry.findFirst({
    where: {
      id: inquiryId,
      tenantId,
      deletedAt: null,
      assignments: { some: { teamLeaderId, tenantId } },
    },
    select: { id: true },
  });
  if (!row) {
    throw new HouseholdLedgerAccessError('배정된 접수만 가계부에 연결할 수 있습니다.', 404);
  }
}

export async function buildHouseholdLedgerPrefillOptions(
  db: PrismaClient,
  opts: { tenantId: string; teamLeaderId: string; inquiryId: string },
): Promise<{
  inquiryId: string;
  inquiryNumber: string | null;
  customerName: string;
  suggestedOccurredOn: Date;
  items: HouseholdLedgerPrefillOption[];
}> {
  await assertTeamLeaderCanAccessInquiry(db, opts.tenantId, opts.teamLeaderId, opts.inquiryId);

  const [inquiry, leader] = await Promise.all([
    db.inquiry.findFirstOrThrow({
      where: { id: opts.inquiryId, tenantId: opts.tenantId },
      select: {
        id: true,
        inquiryNumber: true,
        customerName: true,
        preferredDate: true,
        createdAt: true,
        serviceTotalAmount: true,
        serviceDepositAmount: true,
        serviceBalanceAmount: true,
        orderForm: {
          select: { totalAmount: true, depositAmount: true, balanceAmount: true },
        },
        additionalReceipts: {
          select: { amount: true, settlementChannel: true, description: true },
          orderBy: { sortOrder: 'asc' },
        },
        dbListing: {
          select: {
            id: true,
            feeLedgers: {
              where: { status: 'ACTIVE' },
              select: { feeAmount: true, buyerTenantId: true },
            },
          },
        },
      },
    }),
    db.user.findFirst({
      where: { id: opts.teamLeaderId, tenantId: opts.tenantId },
      select: {
        teamLeaderAdditionalReceiptCompanyShareBps: true,
        teamLeaderHouseholdDepositAsTeamIncome: true,
      },
    }),
  ]);

  const companyBps =
    leader?.teamLeaderAdditionalReceiptCompanyShareBps ?? DEFAULT_ADDITIONAL_COMPANY_SHARE_BPS;
  const teamBps = Math.max(0, Math.min(10000, 10000 - companyBps));
  const built = buildPrefillItemsForInquiry(inquiry as InquiryPrefillSource, opts.tenantId, teamBps, {
    depositAsTeamIncome: leader?.teamLeaderHouseholdDepositAsTeamIncome === true,
  });

  return {
    inquiryId: inquiry.id,
    inquiryNumber: inquiry.inquiryNumber,
    customerName: inquiry.customerName,
    suggestedOccurredOn: built.suggestedOccurredOn,
    items: built.items,
  };
}
