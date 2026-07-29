import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { TeamLeaderHouseholdPrefillKind } from './teamLeaderHouseholdLedger.constants.js';
import {
  buildPrefillItemsForInquiry,
  DEFAULT_ADDITIONAL_COMPANY_SHARE_BPS,
  type InquiryPrefillSource,
} from './teamLeaderHouseholdLedgerPrefill.service.js';

/** 총액 참고(`total`)는 예약금·잔금과 중복되므로 일괄 불러오기에서 제외 */
const SYNC_PREFILL_KINDS = new Set<TeamLeaderHouseholdPrefillKind>([
  'deposit',
  'balance',
  'additional_receipt_team',
  'additional_receipt_field',
  'db_purchase',
]);

const inquiryPrefillSelect = {
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
    orderBy: { sortOrder: 'asc' as const },
  },
  dbListing: {
    select: {
      id: true,
      feeLedgers: {
        where: { status: 'ACTIVE' as const },
        select: { feeAmount: true, buyerTenantId: true },
      },
    },
  },
} satisfies Prisma.InquirySelect;

export type HouseholdLedgerSyncResult = {
  inquiryCount: number;
  created: number;
  skippedExisting: number;
  skippedEmpty: number;
};

export async function syncHouseholdLedgerFromAssignments(
  db: PrismaClient,
  opts: { tenantId: string; teamLeaderId: string },
): Promise<HouseholdLedgerSyncResult> {
  const [assignments, existingRows, leader] = await Promise.all([
    db.assignment.findMany({
      where: {
        tenantId: opts.tenantId,
        teamLeaderId: opts.teamLeaderId,
        teamLeader: { role: 'TEAM_LEADER', tenantId: opts.tenantId },
        inquiry: { deletedAt: null },
      },
      select: { inquiryId: true },
      distinct: ['inquiryId'],
    }),
    db.teamLeaderHouseholdLedgerEntry.findMany({
      where: {
        tenantId: opts.tenantId,
        teamLeaderId: opts.teamLeaderId,
        inquiryId: { not: null },
        prefillKind: { not: null },
      },
      select: { inquiryId: true, prefillKind: true },
    }),
    db.user.findFirst({
      where: { id: opts.teamLeaderId, tenantId: opts.tenantId },
      select: { teamLeaderAdditionalReceiptCompanyShareBps: true },
    }),
  ]);

  const inquiryIds = assignments.map((a) => a.inquiryId);
  if (inquiryIds.length === 0) {
    return { inquiryCount: 0, created: 0, skippedExisting: 0, skippedEmpty: 0 };
  }

  const inquiries = await db.inquiry.findMany({
    where: { tenantId: opts.tenantId, id: { in: inquiryIds }, deletedAt: null },
    select: inquiryPrefillSelect,
  });

  const existingKeys = new Set(
    existingRows.map((r) => `${r.inquiryId}:${r.prefillKind}`),
  );

  const companyBps =
    leader?.teamLeaderAdditionalReceiptCompanyShareBps ?? DEFAULT_ADDITIONAL_COMPANY_SHARE_BPS;
  const teamBps = Math.max(0, Math.min(10000, 10000 - companyBps));

  let skippedExisting = 0;
  let skippedEmpty = 0;
  const toCreate: Prisma.TeamLeaderHouseholdLedgerEntryCreateManyInput[] = [];

  for (const inquiry of inquiries) {
    const row = inquiry as InquiryPrefillSource;
    const { suggestedOccurredOn, items } = buildPrefillItemsForInquiry(
      row,
      opts.tenantId,
      teamBps,
    );

    for (const item of items) {
      if (!SYNC_PREFILL_KINDS.has(item.kind)) {
        skippedEmpty += 1;
        continue;
      }
      const key = `${inquiry.id}:${item.kind}`;
      if (existingKeys.has(key)) {
        skippedExisting += 1;
        continue;
      }

      toCreate.push({
        id: randomUUID(),
        tenantId: opts.tenantId,
        teamLeaderId: opts.teamLeaderId,
        direction: item.direction,
        occurredOn: suggestedOccurredOn,
        category: item.category,
        amount: item.amount,
        memo: item.memoHint,
        inquiryId: inquiry.id,
        prefillKind: item.kind,
      });
      existingKeys.add(key);
    }
  }

  const batchSize = 200;
  for (let i = 0; i < toCreate.length; i += batchSize) {
    await db.teamLeaderHouseholdLedgerEntry.createMany({
      data: toCreate.slice(i, i + batchSize),
    });
  }

  return {
    inquiryCount: inquiryIds.length,
    created: toCreate.length,
    skippedExisting,
    skippedEmpty,
  };
}
