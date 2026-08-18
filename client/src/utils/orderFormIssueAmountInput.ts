/** 발주서 발급 총액 입력 (원 단위) */

/** DB INT4·업무 상한 (원) */
export const ORDER_FORM_ISSUE_AMOUNT_MAX_WON = 500_000_000;

export function parseIssueAmountWon(raw: string): number {
  const n = parseInt(raw.replace(/,/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** 발급 금액 입력란 — 비어 있으면 null, `"0"` 은 0 */
export function parseOptionalIssueAmountWon(raw: string): number | null {
  const trimmed = raw.replace(/,/g, '').trim();
  if (!trimmed) return null;
  return parseIssueAmountWon(trimmed);
}

/** 예약금 — 비어 있으면 기본 20,000원, `"0"` 은 예약금 없음 */
export function resolveIssueDepositWon(raw: string, defaultWon = 20_000): number {
  const parsed = parseOptionalIssueAmountWon(raw);
  return parsed != null ? parsed : defaultWon;
}

/** 잔금 — 비어 있으면 총액−예약금 (예약금 0이면 총액) */
export function resolveIssueBalanceWon(total: number, deposit: number, raw: string): number {
  const parsed = parseOptionalIssueAmountWon(raw);
  if (parsed != null) return parsed;
  return Math.max(0, total - deposit);
}

export function validateIssueAmountWon(won: number, label = '금액'): string | null {
  if (!Number.isFinite(won) || won < 0) return `${label}을(를) 입력해 주세요.`;
  if (won > ORDER_FORM_ISSUE_AMOUNT_MAX_WON) {
    return `${label}은(는) ${(ORDER_FORM_ISSUE_AMOUNT_MAX_WON / 10_000).toLocaleString('ko-KR')}만원 이하여야 합니다.`;
  }
  return null;
}

/** 원 단위 숫자·쉼표만 허용 */
export function sanitizeIssueTotalWonInput(raw: string): string {
  return raw.replace(/[^\d,]/g, '');
}

export function addIssueTotalWon(currentWonRaw: string, deltaWon: number): string {
  const cur = parseIssueAmountWon(currentWonRaw);
  const next = (Number.isNaN(cur) ? 0 : cur) + deltaWon;
  if (next > ORDER_FORM_ISSUE_AMOUNT_MAX_WON) return String(ORDER_FORM_ISSUE_AMOUNT_MAX_WON);
  if (next < 0) return '0';
  return String(next);
}

/**
 * 「단위만원」 — 입력 숫자 뒤에 0000 붙여 원화로 확정 (24 → 240000).
 * 이미 1만원(10000) 이상이면 그대로 둔다.
 */
export function applyManwonUnitZeros(wonRaw: string): string {
  const digits = wonRaw.replace(/,/g, '').replace(/\D/g, '');
  if (!digits) return '';
  const trimmed = digits.replace(/^0+/, '') || '0';
  const cur = parseInt(trimmed, 10);
  if (!Number.isFinite(cur) || cur <= 0) return '';
  if (cur >= 10_000) {
    return String(Math.min(cur, ORDER_FORM_ISSUE_AMOUNT_MAX_WON));
  }
  const next = parseInt(`${trimmed}0000`, 10);
  if (!Number.isFinite(next) || next <= 0) return '';
  return String(Math.min(next, ORDER_FORM_ISSUE_AMOUNT_MAX_WON));
}
