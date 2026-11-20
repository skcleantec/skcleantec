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

/**
 * 평수와 카드 계산식이 맞을 때만 숫자를 준다.
 * 그 외에는 금액 자리를 비운다.
 */
export function resolveCoachMoneyLine(input: {
  q: string;
  pyeong?: string | null;
  rules: string[];
}): string {
  const pyeong = parseCoachPyeong(input.pyeong);
  if (hasExteriorFormula(input.q, input.rules) && pyeong != null) {
    const amount = formatManWon(exteriorWindowManWon(pyeong));
    return `계산된 금액: ${amount}. 이 숫자만 말한다. 카드에 적힌 다른 평수 예시는 옮기지 않는다.`;
  }
  return '고객 평수·구조가 없거나 계산식이 확실하지 않다. 금액 자리는 「○○만 원」으로 비운다. 다른 구조의 금액 숫자를 넣지 않는다.';
}
