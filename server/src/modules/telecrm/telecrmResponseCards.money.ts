/** 코치에 넣을 금액. 카드 예시 문장을 그대로 쓰지 않는다. */

const EXTERIOR_FORMULA = /(평수|평당)[\s\S]{0,24}1\s*만|1\s*만[\s\S]{0,24}(빼|−|-)\s*2\s*만/;

export function parseCoachPyeong(raw: string | null | undefined): number | null {
  if (!raw) return null;
  const matched = raw.replace(/,/g, '').match(/(\d+(?:\.\d+)?)/);
  if (!matched) return null;
  const value = Number(matched[1]);
  if (!Number.isFinite(value) || value <= 0 || value > 500) return null;
  return value;
}

/** 외창: 평수×1만 − 2만, 최저 18만. 단위는 만 원. */
export function exteriorWindowManWon(pyeong: number): number {
  return Math.max(18, pyeong - 2);
}

function formatManWon(man: number): string {
  const rounded = Math.round(man * 10) / 10;
  const text = Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  return `${text}만 원`;
}

function hasExteriorFormula(q: string, rules: string[]): boolean {
  const blob = `${q}\n${rules.join('\n')}`;
  return /외창/.test(blob) && EXTERIOR_FORMULA.test(blob);
}

export type CoachQuoteItem = { label: string; manWon: number };

/** 예약금 2만, 리뷰 페이백 2만, 외창 최저 18만 */
const FIXED_ALLOWED_MAN = [2, 18];

function positiveMan(raw: number | null | undefined): number | null {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw <= 0 || raw > 9999) return null;
  return Math.round(raw * 10) / 10;
}

/** 코치에게 넘길 계산된 금액. 견적 합계가 없으면 기본 청소 금액은 비운다. */
export function resolveCoachMoneyLines(input: {
  q: string;
  pyeong?: string | null;
  rules: string[];
  quoteTotalManWon?: number | null;
  quoteItems?: CoachQuoteItem[];
}): string[] {
  const lines: string[] = [];
  const total = positiveMan(input.quoteTotalManWon);
  if (total != null) {
    lines.push(`계산된 금액: 기본 견적 합계: ${formatManWon(total)}(가격 안내 칸 기준). 이 숫자만 말한다.`);
    if (total > 2) {
      lines.push(`계산된 금액: 리뷰 페이백 뒤 실제 부담: ${formatManWon(total - 2)}.`);
    }
  } else {
    lines.push('기본 청소 금액은 「○○만 원」으로 비운다. 카드 문장으로 기본 청소 금액을 짐작하지 않는다.');
  }

  const pyeong = parseCoachPyeong(input.pyeong);
  if (hasExteriorFormula(input.q, input.rules) && pyeong != null) {
    lines.push(
      `계산된 금액: ${formatManWon(exteriorWindowManWon(pyeong))}. 이 숫자만 말한다. 카드에 적힌 다른 평수 예시는 옮기지 않는다.`,
    );
  }

  for (const item of (input.quoteItems ?? []).slice(0, 8)) {
    const man = positiveMan(item.manWon);
    const label = item.label.trim().slice(0, 40);
    if (!label || man == null) continue;
    lines.push(`계산된 금액: ${label} ${formatManWon(man)}.`);
  }
  return lines;
}

export function resolveCoachMoneyLine(input: {
  q: string;
  pyeong?: string | null;
  rules: string[];
  quoteTotalManWon?: number | null;
  quoteItems?: CoachQuoteItem[];
}): string {
  return resolveCoachMoneyLines(input).join('\n');
}

export function collectAllowedManWons(lines: string[]): number[] {
  const allowed = new Set<number>(FIXED_ALLOWED_MAN);
  for (const line of lines) {
    for (const match of line.matchAll(/(\d+(?:\.\d+)?)\s*만/g)) {
      const value = Number(match[1]);
      if (Number.isFinite(value)) allowed.add(value);
    }
  }
  return [...allowed];
}

function near(a: number, b: number): boolean {
  return Math.abs(a - b) < 0.05;
}

/** AI 문장에서 고객 평수와 다른 평, 허용되지 않은 금액을 고친다. */
export function scrubCoachSpeech(
  text: string,
  input: { pyeong: number | null; allowedMan: number[] },
): { text: string; changes: number } {
  let changes = 0;
  let next = text.replace(/(\d+(?:\.\d+)?)\s*평/g, (full, raw: string) => {
    const value = Number(raw);
    if (input.pyeong == null) {
      changes += 1;
      return '';
    }
    if (near(value, input.pyeong)) return full;
    changes += 1;
    const label = Number.isInteger(input.pyeong) ? String(input.pyeong) : String(Math.round(input.pyeong * 10) / 10);
    return `${label}평`;
  });
  next = next.replace(/(\d+(?:\.\d+)?)\s*만\s*원/g, (full, raw: string) => {
    const value = Number(raw);
    if (input.allowedMan.some((allowed) => near(allowed, value))) return full;
    changes += 1;
    return '○○만 원';
  });
  return { text: next, changes };
}
