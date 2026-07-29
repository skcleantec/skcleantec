import type { TeamLeaderHouseholdLedgerDirection } from '@prisma/client';
import type { TeamLeaderHouseholdPrefillKind } from './teamLeaderHouseholdLedger.constants.js';
import {
  TEAM_LEADER_HOUSEHOLD_EXPENSE_CATEGORIES,
  TEAM_LEADER_HOUSEHOLD_INCOME_CATEGORIES,
  TEAM_LEADER_HOUSEHOLD_PREFILL_LABELS,
} from './teamLeaderHouseholdLedger.constants.js';

export type HouseholdLedgerPrefillOption = {
  kind: TeamLeaderHouseholdPrefillKind;
  direction: TeamLeaderHouseholdLedgerDirection;
  category: string;
  amount: number;
  label: string;
  memoHint: string | null;
};

export type HouseholdLedgerEntryDto = {
  id: string;
  direction: TeamLeaderHouseholdLedgerDirection;
  occurredOn: string;
  category: string;
  amount: number;
  memo: string | null;
  inquiryId: string | null;
  inquiryNumber: string | null;
  customerName: string | null;
  prefillKind: string | null;
  createdAt: string;
  updatedAt: string;
};

export function serializeHouseholdLedgerEntry(row: {
  id: string;
  direction: TeamLeaderHouseholdLedgerDirection;
  occurredOn: Date;
  category: string;
  amount: number;
  memo: string | null;
  inquiryId: string | null;
  prefillKind: string | null;
  createdAt: Date;
  updatedAt: Date;
  inquiry?: { inquiryNumber: string | null; customerName: string } | null;
}): HouseholdLedgerEntryDto {
  return {
    id: row.id,
    direction: row.direction,
    occurredOn: row.occurredOn.toISOString().slice(0, 10),
    category: row.category,
    amount: row.amount,
    memo: row.memo,
    inquiryId: row.inquiryId,
    inquiryNumber: row.inquiry?.inquiryNumber ?? null,
    customerName: row.inquiry?.customerName ?? null,
    prefillKind: row.prefillKind,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export function isAllowedHouseholdCategory(
  direction: TeamLeaderHouseholdLedgerDirection,
  category: string,
): boolean {
  const trimmed = category.trim();
  if (!trimmed) return false;
  const allowed =
    direction === 'INCOME'
      ? TEAM_LEADER_HOUSEHOLD_INCOME_CATEGORIES
      : TEAM_LEADER_HOUSEHOLD_EXPENSE_CATEGORIES;
  return (allowed as readonly string[]).includes(trimmed) || trimmed.length <= 64;
}

export function prefillLabel(kind: TeamLeaderHouseholdPrefillKind): string {
  return TEAM_LEADER_HOUSEHOLD_PREFILL_LABELS[kind] ?? kind;
}
