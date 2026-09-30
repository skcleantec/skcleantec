/** OpenAI 제품 구분 — 키·usage 로그·원가 집계 단위 */
export type AiProductKey = 'quick_paste' | 'telecrm_summary' | 'ai_dispatch';

export const AI_PRODUCT_KEYS = ['quick_paste', 'telecrm_summary', 'ai_dispatch'] as const satisfies readonly AiProductKey[];

export type QuickPasteAiOperation = 'understand' | 'review';
