/** 카카오·문자 붙여넣기 — 원화 금액 파싱 (만원·콤마·원 단위 구분) */

const COST_LABEL_RE =
  /(?:청소\s*비용|청소\s*비|청소\s*잔금|서비스\s*금액|결제\s*금액|잔금|당일\s*결제|총\s*금액|금액|비용)\s*[:：]?\s*/i;

const WON_WITH_LABEL_RE =
  /(?:청소\s*비용|청소\s*비|청소\s*잔금|서비스\s*금액|결제\s*금액|잔금|당일\s*결제|총\s*금액)\s*[:：]?\s*([\d,]+(?:\.\d+)?)\s*(만\s*원?|원)?/gi;
const MAN_WON_RE = /(\d+(?:\.\d+)?)\s*만\s*원?/gi;
const PLAIN_WON_RE = /([\d,]+)\s*원/g;

/** 광고·포함 서비스 문구 (잔금이 아님) */
function isPromotionalAmountContext(line: string): boolean {
  const t = line.replace(/\s+/g, ' ');
  if (/(?:상당|포함\s*서비스|기본\s*서비스|제공|✔|✓|☑|💖|무상|A\/S)/i.test(t)) return true;
  if (/살균|코팅|방역|피톤치드|스팀/.test(t) && !COST_LABEL_RE.test(t)) return true;
  return false;
}

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
  } else if (n >= 1 && n <= 999 && /잔|잔금|결제|비용|금액/.test(ctx)) {
    value = Math.round(n * 10_000);
  } else {
    return null;
  }

  if (value >= 5_000 && value <= 50_000_000) return value;
  return null;
}

function lineAround(text: string, index: number, len = 100): string {
  const lineStart = text.lastIndexOf('\n', index) + 1;
  const lineEnd = text.indexOf('\n', index);
  return text.slice(lineStart, lineEnd < 0 ? undefined : lineEnd).trim().slice(0, len);
}

type AmountHit = { value: number; index: number; match: string; line: string; labeled: boolean };

function collectAmountHits(text: string): AmountHit[] {
  const hits: AmountHit[] = [];

  for (const re of [WON_WITH_LABEL_RE, MAN_WON_RE, PLAIN_WON_RE]) {
    re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const numRaw = m[1];
      const v = parseKoreanWonFromMatch(numRaw, m[0]);
      if (v == null || m.index == null) continue;
      const line = lineAround(text, m.index);
      const labeled = COST_LABEL_RE.test(line) || WON_WITH_LABEL_RE.test(m[0]);
      // reset lastIndex side-effect from .test on global — use non-global check
      hits.push({
        value: v,
        index: m.index,
        match: m[0],
        line,
        labeled: /(?:청소\s*비용|청소\s*비|청소\s*잔금|서비스\s*금액|결제\s*금액|잔금|당일\s*결제|총\s*금액|금액|비용)/i.test(
          line,
        ),
      });
    }
  }

  return hits;
}

function scoreHit(hit: AmountHit): number {
  if (isPromotionalAmountContext(hit.line)) return -100;
  let score = 0;
  if (hit.labeled) score += 50;
  if (/(?:청소\s*비용|청소\s*비)/i.test(hit.line)) score += 30;
  if (/(?:잔금|당일\s*결제)/i.test(hit.line)) score += 25;
  if (/만\s*원?/.test(hit.match)) score += 5;
  return score;
}

function pickBestHit(hits: AmountHit[]): AmountHit | null {
  const ranked = hits
    .map((h) => ({ h, score: scoreHit(h) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || a.h.index - b.h.index);
  return ranked[0]?.h ?? null;
}

function collectBalanceCandidates(text: string): number[] {
  const hits = collectAmountHits(text).filter((h) => scoreHit(h) > 0);
  return [...new Set(hits.map((h) => h.value))];
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

  const best = pickBestHit(collectAmountHits(text));
  if (best && Math.abs(best.value - balance) / Math.max(best.value, balance) > 0.15) {
    return { value: best.value, corrected: true };
  }

  return { value: balance, corrected: false };
}

export function parseBalanceAmountFromText(text: string): number | null {
  const best = pickBestHit(collectAmountHits(text));
  if (best) return best.value;

  // 라벨만 있고 숫자가 붙은 shorthand: 잔 23
  const shorthand = text.match(/(?:잔|청소\s*잔금|청소\s*비용)\s*(\d{1,3})(?!\d|,)/i);
  if (shorthand) {
    const v = parseKoreanWonFromMatch(shorthand[1], `${shorthand[0]}만원`);
    if (v != null) return v;
  }

  return null;
}

/** 잔금 값에 대응하는 원문 한 줄 (광고 15만 상당 등 제외) */
export function findBalanceEvidenceSnippet(text: string, amount: number | null): string | null {
  const hits = collectAmountHits(text);
  if (hits.length === 0) return null;

  const matching =
    amount != null
      ? hits.filter((h) => h.value === amount && scoreHit(h) > 0)
      : [];

  const pool = matching.length > 0 ? matching : hits.filter((h) => scoreHit(h) > 0);
  const best = pickBestHit(pool.length > 0 ? pool : hits.filter((h) => !isPromotionalAmountContext(h.line)));
  if (!best) return null;

  // 짧은 매치보다 라벨 포함 줄 선호
  const line = best.line.trim();
  if (best.labeled || /만\s*원|원/.test(line)) return line.slice(0, 80);
  return best.match.slice(0, 80);
}
