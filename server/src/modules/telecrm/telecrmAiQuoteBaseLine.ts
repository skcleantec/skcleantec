/**
 * 보낸 견적 payload 에서 「기본청소」 금액만 고른다.
 * 추가시공·옵션·할인 줄은 빼며, 기본 줄을 못 찾으면 null (기록을 남기지 않음).
 */

const EXTRA = /추가|할인|옵션/;
const BASE = /기본청소|기본견적/;

function lineWon(line: Record<string, unknown>): number | null {
  const amount = Number(line.amountWon);
  const qty = line.quantity == null || line.quantity === '' ? 1 : Number(line.quantity);
  if (!Number.isFinite(amount) || !Number.isFinite(qty)) return null;
  const total = Math.round(amount * qty);
  return total > 0 ? total : null;
}

export function pickSentBaseCleaningWon(payload: unknown): number | null {
  if (!payload || typeof payload !== 'object') return null;
  const body = payload as Record<string, unknown>;
  const lines = Array.isArray(body.lines) ? body.lines : [];
  for (const raw of lines) {
    if (!raw || typeof raw !== 'object') continue;
    const line = raw as Record<string, unknown>;
    const text = `${line.label ?? ''} ${line.sublabel ?? ''}`;
    if (EXTRA.test(text)) continue;
    if (/복층/.test(text) && !BASE.test(text)) continue;
    if (!BASE.test(text)) continue;
    const won = lineWon(line);
    if (won != null) return won;
  }
  const base = Number(body.baseEstimateWon);
  if (Number.isFinite(base) && base > 0) return Math.round(base);
  return null;
}
