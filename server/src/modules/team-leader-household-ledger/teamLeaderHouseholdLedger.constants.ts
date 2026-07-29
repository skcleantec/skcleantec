/** @see shared/teamLeaderHouseholdLedger.ts — 동기화 */

export type TeamLeaderHouseholdPrefillKind =
  | 'balance'
  | 'deposit'
  | 'total'
  | 'additional_receipt_team'
  | 'additional_receipt_field'
  | 'db_purchase'
  | 'manual';

export const TEAM_LEADER_HOUSEHOLD_INCOME_CATEGORIES = [
  '잔금',
  '예약금',
  '추가결재(현장)',
  '추가결재(회사입금)',
  '기타 수입',
] as const;

export const TEAM_LEADER_HOUSEHOLD_EXPENSE_CATEGORIES = [
  'DB 구입',
  '현장·자재',
  '인건비·용역',
  '교통·주차',
  '기타 지출',
] as const;

export const TEAM_LEADER_HOUSEHOLD_PREFILL_LABELS: Record<TeamLeaderHouseholdPrefillKind, string> = {
  balance: '잔금',
  deposit: '예약금',
  total: '총액',
  additional_receipt_team: '추가결재(팀장 몫)',
  additional_receipt_field: '추가결재(현장수금)',
  db_purchase: 'DB 구입',
  manual: '직접 입력',
};
