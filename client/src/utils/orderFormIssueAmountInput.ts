/** 발주서 발급 총액 입력 (원 단위) */

/** DB INT4·업무 상한 (원) */
export const ORDER_FORM_ISSUE_AMOUNT_MAX_WON = 500_000_000;

export function parseIssueAmountWon(raw: string): number {
  const n = parseInt(raw.replace(/,/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
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
