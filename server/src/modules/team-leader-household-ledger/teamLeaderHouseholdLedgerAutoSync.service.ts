import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { TeamLeaderHouseholdPrefillKind } from './teamLeaderHouseholdLedger.constants.js';
import {
  buildPrefillItemsForInquiry,
  DEFAULT_ADDITIONAL_COMPANY_SHARE_BPS,
  type InquiryPrefillSource,
} from './teamLeaderHouseholdLedgerPrefill.service.js';

/** 총액 참고(`total`)는 예약금·잔금과 중복되므로 자동·일괄 반영에서 제외 */
export const HOUSEHOLD_LEDGER_SYNC_PREFILL_KINDS = new Set<TeamLeaderHouseholdPrefillKind>([
  'deposit',
  'balance',
  'additional_receipt_team',
  'additional_receipt_field',
  'db_purchase',
]);

export const inquiryHouseholdPrefillSelect = {
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

function applicableSyncKinds(depositAsTeamIncome: boolean): Set<TeamLeaderHouseholdPrefillKind> {
  const kinds = new Set(HOUSEHOLD_LEDGER_SYNC_PREFILL_KINDS);
  if (!depositAsTeamIncome) kinds.delete('deposit');
  return kinds;
}

export async function applyHouseholdLedgerPrefillForInquiryLeader(
  db: PrismaClient,
  opts: { tenantId: string; teamLeaderId: string; inquiryId: string },
): Promise<{ created: number; updated: number; removed: number }> {
  const [leader, inquiry] = await Promise.all([
    db.user.findFirst({
      where: {
        id: opts.teamLeaderId,
        tenantId: opts.tenantId,
        role: 'TEAM_LEADER',
        isActive: true,
      },
      select: {
        teamLeaderAdditionalReceiptCompanyShareBps: true,
        teamLeaderHouseholdDepositAsTeamIncome: true,
      },
    }),
    db.inquiry.findFirst({
      where: { id: opts.inquiryId, tenantId: opts.tenantId, deletedAt: null },
      select: inquiryHouseholdPrefillSelect,
    }),
  ]);

  if (!leader || !inquiry) return { created: 0, updated: 0, removed: 0 };

  const assigned = await db.assignment.findFirst({
    where: {
      tenantId: opts.tenantId,
      inquiryId: opts.inquiryId,
      teamLeaderId: opts.teamLeaderId,
    },
    select: { id: true },
  });
  if (!assigned) return { created: 0, updated: 0, removed: 0 };

  const depositAsTeamIncome = leader.teamLeaderHouseholdDepositAsTeamIncome === true;
  const companyBps =
    leader.teamLeaderAdditionalReceiptCompanyShareBps ?? DEFAULT_ADDITIONAL_COMPANY_SHARE_BPS;
  const teamBps = Math.max(0, Math.min(10000, 10000 - companyBps));
  const { suggestedOccurredOn, items } = buildPrefillItemsForInquiry(
    inquiry as InquiryPrefillSource,
    opts.tenantId,
    teamBps,
    { depositAsTeamIncome },
  );
  const itemByKind = new Map(items.map((item) => [item.kind, item]));
  const kinds = applicableSyncKinds(depositAsTeamIncome);

  let created = 0;
  let updated = 0;
  let removed = 0;

  for (const kind of kinds) {
    const item = itemByKind.get(kind);
    const existing = await db.teamLeaderHouseholdLedgerEntry.findFirst({
      where: {
        tenantId: opts.tenantId,
        teamLeaderId: opts.teamLeaderId,
        inquiryId: opts.inquiryId,
        prefillKind: kind,
      },
      select: { id: true },
    });

    if (!item) {
      if (existing) {
        await db.teamLeaderHouseholdLedgerEntry.delete({ where: { id: existing.id } });
        removed += 1;
      }
      continue;
    }

    if (existing) {
      await db.teamLeaderHouseholdLedgerEntry.update({
        where: { id: existing.id },
        data: {
          direction: item.direction,
          occurredOn: suggestedOccurredOn,
          category: item.category,
          amount: item.amount,
          memo: item.memoHint,
        },
      });
      updated += 1;
    } else {
      await db.teamLeaderHouseholdLedgerEntry.create({
        data: {
          id: randomUUID(),
          tenantId: opts.tenantId,
          teamLeaderId: opts.teamLeaderId,
          direction: item.direction,
          occurredOn: suggestedOccurredOn,
          category: item.category,
          amount: item.amount,
          memo: item.memoHint,
          inquiryId: opts.inquiryId,
          prefillKind: kind,
        },
      });
      created += 1;
    }
  }

  if (!depositAsTeamIncome) {
    const r = await db.teamLeaderHouseholdLedgerEntry.deleteMany({
      where: {
        tenantId: opts.tenantId,
        teamLeaderId: opts.teamLeaderId,
        inquiryId: opts.inquiryId,
        prefillKind: 'deposit',
      },
    });
    removed += r.count;
  }

  return { created, updated, removed };
}

export async function syncHouseholdLedgerForInquiryAssignments(
  db: PrismaClient,
  opts: { tenantId: string; inquiryId: string },
): Promise<void> {
  const assignments = await db.assignment.findMany({
    where: { tenantId: opts.tenantId, inquiryId: opts.inquiryId },
    select: { teamLeaderId: true, teamLeader: { select: { role: true } } },
  });
  const leaderIds = assignments
    .filter((a) => a.teamLeader.role === 'TEAM_LEADER')
    .map((a) => a.teamLeaderId);

  for (const teamLeaderId of leaderIds) {
    await applyHouseholdLedgerPrefillForInquiryLeader(db, {
      tenantId: opts.tenantId,
      teamLeaderId,
      inquiryId: opts.inquiryId,
    });
  }

  await db.teamLeaderHouseholdLedgerEntry.deleteMany({
    where: {
      tenantId: opts.tenantId,
      inquiryId: opts.inquiryId,
      prefillKind: { not: null },
      ...(leaderIds.length > 0 ? { teamLeaderId: { notIn: leaderIds } } : {}),
    },
  });
}

export function queueHouseholdLedgerInquirySync(
  db: PrismaClient,
  opts: { tenantId: string; inquiryId: string },
): void {
  void syncHouseholdLedgerForInquiryAssignments(db, opts).catch((e) =>
    console.error('[household-ledger] auto sync failed', opts, e),
  );
}

export async function resyncHouseholdLedgerForAllTeamLeaders(
  db: PrismaClient,
  tenantId: string,
): Promise<{ leaderCount: number; inquiryCount: number }> {
  const leaders = await db.user.findMany({
    where: { tenantId, role: 'TEAM_LEADER', isActive: true },
    select: { id: true },
  });
  const assignments = await db.assignment.findMany({
    where: {
      tenantId,
      teamLeaderId: { in: leaders.map((l) => l.id) },
      teamLeader: { role: 'TEAM_LEADER' },
      inquiry: { deletedAt: null },
    },
    select: { inquiryId: true },
    distinct: ['inquiryId'],
  });

  for (const row of assignments) {
    await syncHouseholdLedgerForInquiryAssignments(db, {
      tenantId,
      inquiryId: row.inquiryId,
    });
  }

  return { leaderCount: leaders.length, inquiryCount: assignments.length };
}
