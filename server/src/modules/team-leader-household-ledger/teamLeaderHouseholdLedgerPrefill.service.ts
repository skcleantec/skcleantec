import type { PrismaClient } from '@prisma/client';
import type { TeamLeaderHouseholdPrefillKind } from './teamLeaderHouseholdLedger.constants.js';
import {
  type HouseholdLedgerPrefillOption,
  prefillLabel,
} from './teamLeaderHouseholdLedger.serialize.js';

const DEFAULT_ADDITIONAL_COMPANY_SHARE_BPS = 5000;

export class HouseholdLedgerAccessError extends Error {
  constructor(
    message: string,
    readonly status = 403,
  ) {
    super(message);
    this.name = 'HouseholdLedgerAccessError';
  }
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
): Promise<{ inquiryId: string; inquiryNumber: string | null; customerName: string; items: HouseholdLedgerPrefillOption[] }> {
  await assertTeamLeaderCanAccessInquiry(db, opts.tenantId, opts.teamLeaderId, opts.inquiryId);

  const [inquiry, leader] = await Promise.all([
    db.inquiry.findFirstOrThrow({
      where: { id: opts.inquiryId, tenantId: opts.tenantId },
      select: {
        id: true,
        inquiryNumber: true,
        customerName: true,
        serviceTotalAmount: true,
        serviceDepositAmount: true,
        serviceBalanceAmount: true,
        additionalReceipts: {
          select: { amount: true, settlementChannel: true, description: true },
          orderBy: { sortOrder: 'asc' },
        },
        dbListing: {
          select: {
            id: true,
            feeLedgers: {
              where: { status: 'ACTIVE', buyerTenantId: opts.tenantId },
              select: { feeAmount: true },
              take: 1,
            },
          },
        },
      },
    }),
    db.user.findFirst({
      where: { id: opts.teamLeaderId, tenantId: opts.tenantId },
      select: { teamLeaderAdditionalReceiptCompanyShareBps: true },
    }),
  ]);

  const companyBps = leader?.teamLeaderAdditionalReceiptCompanyShareBps ?? DEFAULT_ADDITIONAL_COMPANY_SHARE_BPS;
  const teamBps = Math.max(0, Math.min(10000, 10000 - companyBps));

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

  push(
    'deposit',
    'INCOME',
    '예약금',
    inquiry.serviceDepositAmount,
    `${inquiry.customerName} · 예약금`,
  );
  push('balance', 'INCOME', '잔금', inquiry.serviceBalanceAmount, `${inquiry.customerName} · 잔금`);
  push('total', 'INCOME', '기타 수입', inquiry.serviceTotalAmount, `${inquiry.customerName} · 총액 참고`);

  let addCompanyTeamSum = 0;
  let addFieldSum = 0;
  for (const r of inquiry.additionalReceipts) {
    const amt = Math.max(0, r.amount);
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

  const dbFee = inquiry.dbListing?.feeLedgers[0]?.feeAmount;
  push('db_purchase', 'EXPENSE', 'DB 구입', dbFee, `${inquiry.customerName} · DB 구입비`);

  return {
    inquiryId: inquiry.id,
    inquiryNumber: inquiry.inquiryNumber,
    customerName: inquiry.customerName,
    items,
  };
}
