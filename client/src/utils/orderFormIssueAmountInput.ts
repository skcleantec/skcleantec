/** 발주서 발급 총액 — 모바일 숫자 입력은 만원(10,000원) 단위 */

export function parseIssueAmountWon(raw: string): number {
  const n = parseInt(raw.replace(/,/g, ''), 10);
  return Number.isNaN(n) ? 0 : n;
}

/** 모바일 입력란 표시 — 내부 원화 → 만원 (예: 240000 → "24", 241000 → "24.1") */
export function formatIssueTotalManwonDisplay(wonRaw: string): string {
  const trimmed = wonRaw.trim();
  if (!trimmed) return '';
  const won = parseIssueAmountWon(trimmed);
  if (won <= 0) return '';
  const manwon = won / 10_000;
  if (Number.isInteger(manwon)) return String(manwon);
  return manwon.toFixed(1).replace(/\.0$/, '');
}

/** 모바일 입력 문자열 → 저장용 원화 문자열 (쉼표 무시, "2,4" → 240000) */
export function parseIssueTotalManwonInput(raw: string): string {
  const cleaned = raw.replace(/,/g, '').replace(/[^\d.]/g, '').trim();
  if (!cleaned) return '';
  const manwon = parseFloat(cleaned);
  if (!Number.isFinite(manwon) || manwon < 0) return '';
  return String(Math.round(manwon * 10_000));
}

/** 데스크톱 — 원 단위 숫자·쉼표만 허용 */
export function sanitizeIssueTotalWonInput(raw: string): string {
  return raw.replace(/[^\d,]/g, '');
}

export function addIssueTotalWon(currentWonRaw: string, deltaWon: number): string {
  const cur = parseIssueAmountWon(currentWonRaw);
  return String((Number.isNaN(cur) ? 0 : cur) + deltaWon);
}
