/** @see shared/teamLeaderHouseholdLedger.ts — 동기화 */

export type TeamLeaderHouseholdPrefillKind =
  | 'balance'
  | 'deposit'
  | 'total'
  | 'additional_receipt_team'
  | 'additional_receipt_field'
  | 'db_purchase'
  | 'manual'
  | 'wage_daily'
  | 'wage_monthly';

export type TeamLeaderHouseholdWageMode = 'BALANCE_PCT' | 'DAILY' | 'MONTHLY';

export const TEAM_LEADER_HOUSEHOLD_WAGE_MODES = ['BALANCE_PCT', 'DAILY', 'MONTHLY'] as const;

export const TEAM_LEADER_HOUSEHOLD_INCOME_CATEGORIES = [
  '잔금',
  '일당',
  '월급',
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
  wage_daily: '일당',
  wage_monthly: '월급',
};

export const TEAM_LEADER_HOUSEHOLD_WAGE_MODE_LABELS: Record<TeamLeaderHouseholdWageMode, string> = {
  BALANCE_PCT: '잔금',
  DAILY: '일당',
  MONTHLY: '월급',
};

export function hiddenHouseholdPrefillKinds(mode: TeamLeaderHouseholdWageMode): string[] {
  if (mode === 'DAILY') return ['balance', 'wage_monthly'];
  if (mode === 'MONTHLY') return ['balance', 'wage_daily'];
  return ['wage_daily', 'wage_monthly'];
}

export function householdWageDailyKey(ymd: string): string {
  return `D:${ymd}`;
}

export function householdWageMonthlyKey(ym: string): string {
  return `M:${ym}`;
}
