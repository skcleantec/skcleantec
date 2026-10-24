import { randomUUID } from 'node:crypto';
import type { Prisma, PrismaClient } from '@prisma/client';
import type { TeamLeaderHouseholdPrefillKind } from './teamLeaderHouseholdLedger.constants.js';
import {
  buildPrefillItemsForInquiry,
  DEFAULT_ADDITIONAL_COMPANY_SHARE_BPS,
  type InquiryPrefillSource,
} from './teamLeaderHouseholdLedgerPrefill.service.js';
import { getHouseholdWageSetting, syncHouseholdWageEntries } from './teamLeaderHouseholdWage.service.js';
import { resolveFieldOwnerIds } from '../../lib/fieldOwner.js';
import { getEffectiveEnabledModules } from '../tenants/tenantFeatures.service.js';
import { isSoloOperatorTenant } from '../../lib/soloOperator.js';

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
        isActive: true,
        role: { in: ['TEAM_LEADER', 'ADMIN'] },
      },
      select: {
        role: true,
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

  if (leader.role === 'TEAM_LEADER') {
    const assigned = await db.assignment.findFirst({
      where: {
        tenantId: opts.tenantId,
        inquiryId: opts.inquiryId,
        teamLeaderId: opts.teamLeaderId,
      },
      select: { id: true },
    });
    if (!assigned) return { created: 0, updated: 0, removed: 0 };
  } else if (leader.role === 'ADMIN') {
    const enabled = await getEffectiveEnabledModules(opts.tenantId);
    if (!isSoloOperatorTenant(enabled)) return { created: 0, updated: 0, removed: 0 };
    const owners = await resolveFieldOwnerIds(opts.tenantId, opts.inquiryId);
    if (!owners.includes(opts.teamLeaderId)) return { created: 0, updated: 0, removed: 0 };
  } else {
    return { created: 0, updated: 0, removed: 0 };
  }

  const depositAsTeamIncome = leader.teamLeaderHouseholdDepositAsTeamIncome === true;
  const companyBps =
    leader.teamLeaderAdditionalReceiptCompanyShareBps ?? DEFAULT_ADDITIONAL_COMPANY_SHARE_BPS;
  const teamBps = Math.max(0, Math.min(10000, 10000 - companyBps));
  const { setting, suppressedWageKeys } = await getHouseholdWageSetting(db, {
    tenantId: opts.tenantId,
    teamLeaderId: opts.teamLeaderId,
  });
  const { suggestedOccurredOn, items } = buildPrefillItemsForInquiry(
    inquiry as InquiryPrefillSource,
    opts.tenantId,
    teamBps,
    { depositAsTeamIncome },
  );
  if (setting.wageMode === 'BALANCE_PCT' && setting.balanceSharePercent !== 100) {
    for (const item of items) {
      if (item.kind !== 'balance') continue;
      item.amount = Math.max(0, Math.floor((item.amount * setting.balanceSharePercent) / 100));
    }
  }
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
      select: { id: true, amountLocked: true },
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
          ...(existing.amountLocked ? {} : { amount: item.amount }),
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

  if (setting.wageMode === 'DAILY' || setting.wageMode === 'MONTHLY') {
    await syncHouseholdWageEntries(db, {
      tenantId: opts.tenantId,
      teamLeaderId: opts.teamLeaderId,
      setting,
      suppressedWageKeys,
    });
  }

  return { created, updated, removed };
}

export async function syncHouseholdLedgerForInquiryAssignments(
  db: PrismaClient,
  opts: { tenantId: string; inquiryId: string },
): Promise<void> {
  const ownerIds = await resolveFieldOwnerIds(opts.tenantId, opts.inquiryId);
  const owners = ownerIds.length
    ? await db.user.findMany({
        where: {
          tenantId: opts.tenantId,
          id: { in: ownerIds },
          isActive: true,
          role: { in: ['TEAM_LEADER', 'ADMIN'] },
        },
        select: { id: true, role: true },
      })
    : [];
  const ledgerIds = owners
    .filter((owner) => owner.role === 'TEAM_LEADER' || owner.role === 'ADMIN')
    .map((owner) => owner.id);

  for (const teamLeaderId of ledgerIds) {
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
      ...(ledgerIds.length > 0 ? { teamLeaderId: { notIn: ledgerIds } } : {}),
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

  const enabled = await getEffectiveEnabledModules(tenantId);
  const soloInquiries = isSoloOperatorTenant(enabled)
    ? await db.inquiry.findMany({
        where: { tenantId, deletedAt: null, assignments: { none: {} } },
        select: { id: true },
      })
    : [];

  const inquiryIds = new Set<string>([
    ...assignments.map((row) => row.inquiryId),
    ...soloInquiries.map((row) => row.id),
  ]);

  for (const inquiryId of inquiryIds) {
    await syncHouseholdLedgerForInquiryAssignments(db, {
      tenantId,
      inquiryId,
    });
  }

  return { leaderCount: leaders.length, inquiryCount: inquiryIds.size };
}
