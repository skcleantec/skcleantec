/** 텔레CRM — 숨고 견적보내기 플레이스홀더 (shared) */
import type { SoomgoMessageStep } from './soomgoMessagePresets';
import { applyTelecrmSoomgoFollowupPlaceholders } from './telecrmSoomgoFollowupAuto';

export type SoomgoQuotePlaceholderCtx = {
  customerName?: string;
  nickname?: string;
  quoteTotalWon?: number | null;
  paybackWon?: number | null;
  pyeong?: string;
};

export function formatSoomgoQuoteWon(n: number): string {
  return `${Number(n).toLocaleString('ko-KR')}원`;
}

export function computeSoomgoEventPriceWon(
  quoteTotalWon: number | null | undefined,
  paybackWon: number | null | undefined,
): number | null {
  if (quoteTotalWon == null || !Number.isFinite(quoteTotalWon)) return null;
  const payback = Math.max(0, Math.floor(Number(paybackWon) || 0));
  return Math.max(0, Math.floor(quoteTotalWon) - payback);
}

export function applySoomgoQuotePlaceholders(text: string, ctx: SoomgoQuotePlaceholderCtx): string {
  let result = applyTelecrmSoomgoFollowupPlaceholders(text, ctx);
  const quote = ctx.quoteTotalWon;
  const payback = Math.max(0, Math.floor(Number(ctx.paybackWon) || 0));
  const eventPrice = computeSoomgoEventPriceWon(quote, payback);

  if (quote != null && Number.isFinite(quote)) {
    const formatted = formatSoomgoQuoteWon(Math.floor(quote));
    result = result.replace(/\{견적가\}/g, formatted);
    result = result.replace(/\{예상가\}/g, formatted);
  }
  if (payback > 0) {
    result = result.replace(/\{페이백금액\}/g, formatSoomgoQuoteWon(payback));
  }
  if (eventPrice != null) {
    const formatted = formatSoomgoQuoteWon(eventPrice);
    result = result.replace(/\{이벤트가\}/g, formatted);
    result = result.replace(/\{페이백금액을 뺀 견적가\}/g, formatted);
    result = result.replace(/\{페이백금액을뺀 견적가\}/g, formatted);
  }
  const pyeong = ctx.pyeong?.trim();
  if (pyeong) {
    result = result.replace(/\{평수\}/g, pyeong);
  }
  return result;
}

export function applySoomgoQuotePlaceholdersToSteps(
  steps: SoomgoMessageStep[],
  ctx: SoomgoQuotePlaceholderCtx,
): SoomgoMessageStep[] {
  return steps.map((step) => {
    if (step.type === 'text') {
      return { type: 'text', text: applySoomgoQuotePlaceholders(step.text, ctx) };
    }
    return step;
  });
}

export const SOOMGO_QUOTE_PLACEHOLDER_HINTS = [
  '{고객명}',
  '{닉네임}',
  '{견적가}',
  '{이벤트가}',
  '{페이백금액}',
  '{페이백금액을 뺀 견적가}',
  '{평수}',
  '{예상가}',
] as const;
