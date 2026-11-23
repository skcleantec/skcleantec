/** 발주서 추가 시공 — 이름·금액 줄. 전문 시공 옵션·추가 사항 글과 별개. */

export const ORDER_FORM_EXTRA_WORK_SUGGESTED_NAMES = ['인테리어 청소', '특수청소'] as const;

export const ORDER_FORM_EXTRA_WORK_MAX_LINES = 5;
export const ORDER_FORM_EXTRA_WORK_NAME_MAX = 30;

export type OrderFormExtraWorkLine = {
  name: string;
  amountWon: number;
};

export type NormalizeOrderFormExtraWorksResult =
  | { ok: true; lines: OrderFormExtraWorkLine[] }
  | { ok: false; error: string };

function parseNonNegativeInt(raw: unknown): number | null {
  if (typeof raw === 'boolean' || raw == null || raw === '') return null;
  if (typeof raw === 'number') {
    if (!Number.isFinite(raw) || !Number.isInteger(raw) || raw < 0) return null;
    return raw;
  }
  const text = String(raw).replace(/,/g, '').trim();
  if (!/^\d+$/.test(text)) return null;
  const n = Number(text);
  if (!Number.isSafeInteger(n) || n < 0) return null;
  return n;
}

/** 빈 이름 줄은 빼고, 이름·금액·줄 수가 규칙을 넘으면 거절한다. */
export function normalizeOrderFormExtraWorks(raw: unknown): NormalizeOrderFormExtraWorksResult {
  if (raw == null || raw === '') return { ok: true, lines: [] };
  if (!Array.isArray(raw)) {
    return { ok: false, error: '추가 시공 형식이 올바르지 않습니다.' };
  }
  const lines: OrderFormExtraWorkLine[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object' || Array.isArray(row)) {
      return { ok: false, error: '추가 시공 형식이 올바르지 않습니다.' };
    }
    const rec = row as Record<string, unknown>;
    const name = String(rec.name ?? '').trim();
    if (!name) continue;
    if (name.length > ORDER_FORM_EXTRA_WORK_NAME_MAX) {
      return {
        ok: false,
        error: `추가 시공 이름은 ${ORDER_FORM_EXTRA_WORK_NAME_MAX}자까지 입력할 수 있습니다.`,
      };
    }
    const amountWon = parseNonNegativeInt(rec.amountWon);
    if (amountWon == null) {
      return { ok: false, error: '추가 시공 금액은 0 이상의 정수여야 합니다.' };
    }
    lines.push({ name, amountWon });
  }
  if (lines.length > ORDER_FORM_EXTRA_WORK_MAX_LINES) {
    return { ok: false, error: `추가 시공은 ${ORDER_FORM_EXTRA_WORK_MAX_LINES}줄까지 넣을 수 있습니다.` };
  }
  return { ok: true, lines };
}

export function sumOrderFormExtraWorks(lines: readonly OrderFormExtraWorkLine[]): number {
  return lines.reduce((sum, line) => sum + line.amountWon, 0);
}

/** 기본 청소 금액 + 추가 시공 합계가 총액과 같은지. */
export function orderFormExtraWorksTotalMatches(
  baseAmount: number,
  lines: readonly OrderFormExtraWorkLine[],
  totalAmount: number,
): boolean {
  return baseAmount + sumOrderFormExtraWorks(lines) === totalAmount;
}

export const ORDER_FORM_EXTRA_WORKS_NEED_BASE = '추가 시공이 있으면 기본 청소 금액을 입력해 주세요.';
export const ORDER_FORM_EXTRA_WORKS_NEED_KIND = '추가 시공이 있으면 청소 종류를 먼저 정해 주세요.';

export type ResolvedOrderFormIssueMoney =
  | { ok: true; hasExtraWorks: false }
  | {
      ok: true;
      hasExtraWorks: true;
      lines: OrderFormExtraWorkLine[];
      baseAmount: number;
      totalAmount: number;
      balanceAmount: number;
    }
  | { ok: false; error: string };

/**
 * 추가 시공이 있으면 총액·잔금을 서버가 다시 계산한다.
 * 한 줄도 없으면 기존 총액·잔금 계산을 그대로 쓴다.
 */
export function resolveOrderFormIssueMoney(input: {
  extraWorks: unknown;
  baseAmount: unknown;
  depositAmount: number;
  cleaningKind: string | null;
}): ResolvedOrderFormIssueMoney {
  const normalized = normalizeOrderFormExtraWorks(input.extraWorks);
  if (!normalized.ok) return normalized;
  if (normalized.lines.length === 0) return { ok: true, hasExtraWorks: false };

  const kind = input.cleaningKind?.trim() ?? '';
  if (!kind) return { ok: false, error: ORDER_FORM_EXTRA_WORKS_NEED_KIND };

  const baseAmount = parseNonNegativeInt(input.baseAmount);
  if (baseAmount == null) return { ok: false, error: ORDER_FORM_EXTRA_WORKS_NEED_BASE };

  const deposit = input.depositAmount;
  if (!Number.isInteger(deposit) || deposit < 0) {
    return { ok: false, error: '예약금이 올바르지 않습니다.' };
  }
  const totalAmount = baseAmount + sumOrderFormExtraWorks(normalized.lines);
  const balanceAmount = totalAmount - deposit;
  if (balanceAmount < 0) {
    return { ok: false, error: '예약금이 총액보다 클 수 없습니다.' };
  }
  return {
    ok: true,
    hasExtraWorks: true,
    lines: normalized.lines,
    baseAmount,
    totalAmount,
    balanceAmount,
  };
}
