/** 카카오·문자 붙여넣기 — 원화 금액 파싱 (만원·콤마·원 단위 구분) */

const WON_WITH_LABEL_RE =
  /(?:청소\s*잔금|잔금|당일\s*결제|잔)\s*[:：]?\s*([\d,]+(?:\.\d+)?)\s*(만\s*원?|원)?/gi;
const MAN_WON_RE = /(\d+(?:\.\d+)?)\s*만\s*원?/gi;
const PLAIN_WON_RE = /([\d,]+)\s*원/g;

export function parseKoreanWonFromMatch(numRaw: string, fullMatch: string): number | null {
  const numPart = numRaw.replace(/,/g, '').trim();
  const n = Number(numPart);
  if (!Number.isFinite(n)) return null;

  const ctx = fullMatch.replace(/\s/g, '');
  const hasMan = /만/.test(ctx);
  const hasWon = /원/.test(ctx);
  const hasCommaInRaw = /,/.test(numRaw);

  let value: number;
  if (hasMan && !hasCommaInRaw && n < 1000) {
    value = Math.round(n * 10_000);
  } else if (hasCommaInRaw || (hasWon && n >= 1_000)) {
    value = Math.round(n);
  } else if (hasWon) {
    value = Math.round(n);
  } else if (n >= 5_000 && n <= 50_000_000) {
    value = Math.round(n);
  } else if (n >= 1 && n <= 999 && /잔|잔금|결제/.test(ctx)) {
    value = Math.round(n * 10_000);
  } else {
    return null;
  }

  if (value >= 5_000 && value <= 50_000_000) return value;
  return null;
}

function collectBalanceCandidates(text: string): number[] {
  const found: number[] = [];

  for (const re of [WON_WITH_LABEL_RE, MAN_WON_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const v = parseKoreanWonFromMatch(m[1], m[0]);
      if (v != null) found.push(v);
    }
  }

  const balanceChunk = text.match(/(?:잔금|청소\s*잔금|당일\s*결제)[^\n]{0,80}/i)?.[0] ?? text;
  PLAIN_WON_RE.lastIndex = 0;
  let pm: RegExpExecArray | null;
  while ((pm = PLAIN_WON_RE.exec(balanceChunk)) !== null) {
    const v = parseKoreanWonFromMatch(pm[1], pm[0]);
    if (v != null) found.push(v);
  }

  return [...new Set(found)];
}

/** 규칙 파서 오류(230,000원→230만) 등 로컬 교정 */
export function applyLocalBalanceSanityCheck(
  text: string,
  balance: number | null,
): { value: number | null; corrected: boolean } {
  if (balance == null) return { value: null, corrected: false };
  const candidates = collectBalanceCandidates(text);
  if (candidates.length === 0) return { value: balance, corrected: false };

  if (candidates.includes(balance)) return { value: balance, corrected: false };

  const near10x = candidates.find((c) => c * 10 === balance || c === balance * 10);
  if (near10x != null) return { value: near10x, corrected: true };

  const inText = candidates[0];
  if (inText != null && Math.abs(inText - balance) / Math.max(inText, balance) > 0.15) {
    return { value: inText, corrected: true };
  }

  return { value: balance, corrected: false };
}

export function parseBalanceAmountFromText(text: string): number | null {
  WON_WITH_LABEL_RE.lastIndex = 0;
  const label = WON_WITH_LABEL_RE.exec(text);
  if (label) {
    const v = parseKoreanWonFromMatch(label[1], label[0]);
    if (v != null) return v;
  }

  MAN_WON_RE.lastIndex = 0;
  const manMatch = MAN_WON_RE.exec(text);
  if (manMatch && /잔|당일|결제|청소/.test(text)) {
    const v = parseKoreanWonFromMatch(manMatch[1], manMatch[0]);
    if (v != null) return v;
  }

  const shorthand = text.match(/(?:잔|청소\s*잔금)\s*(\d{1,3})(?!\d|,)/i);
  if (shorthand) {
    const v = parseKoreanWonFromMatch(shorthand[1], `${shorthand[0]}만원`);
    if (v != null) return v;
  }

  const candidates = collectBalanceCandidates(text);
  return candidates[0] ?? null;
}
