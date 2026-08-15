import { normalizePreferredDateOrNull } from './quickPasteDate.helpers.js';
import {
  QUICK_PASTE_DATE_AI_EXAMPLES,
  QUICK_PASTE_NAME_AI_EXAMPLES,
} from './quickPastePatterns.js';
import type { QuickPasteDraft } from './quickPasteParse.service.js';
import type {
  QuickPasteFieldKey,
  QuickPasteOptionalFieldKey,
} from './quickPaste.constants.js';
import { callOpenAiJson, isAiProductConfigured } from '../ai/aiProvider.service.js';
import type { AiUsageLogContext } from '../ai/aiUsageLog.service.js';
import type { QuickPasteAiOperation } from '../ai/aiProduct.constants.js';

export function isQuickPasteAiConfigured(): boolean {
  return isAiProductConfigured('quick_paste');
}

type AiDraftJson = {
  customerName?: string | null;
  customerPhone?: string | null;
  address?: string | null;
  preferredDate?: string | null;
  preferredTime?: string | null;
  serviceBalanceAmount?: number | null;
  areaPyeong?: number | null;
  roomCount?: number | null;
  bathroomCount?: number | null;
  balconyCount?: number | null;
};

type AiUnderstandJson = AiDraftJson & {
  /** 원문 전체 문맥 요약 (한국어 1~2문장) */
  contextSummary?: string | null;
  correctedFields?: string[];
  warnings?: string[];
};

export async function callQuickPasteOpenAiJson(
  system: string,
  user: string,
  log?: { context: AiUsageLogContext; operation: QuickPasteAiOperation | string },
): Promise<Record<string, unknown> | null> {
  if (!isQuickPasteAiConfigured()) return null;
  const { json, failed } = await callOpenAiJson({
    product: 'quick_paste',
    system,
    user,
    temperature: 0.1,
    logContext: log ? { ...log.context, operation: log.operation } : null,
  });
  if (failed || !json) return null;
  return json;
}

function mergeAiPatch(
  draft: QuickPasteDraft,
  patch: AiDraftJson,
  mode: 'fill' | 'review',
): { draft: QuickPasteDraft; changedFields: string[] } {
  const next: QuickPasteDraft = { ...draft };
  const changedFields: string[] = [];

  const apply = (key: keyof QuickPasteDraft, value: unknown) => {
    if (value == null || value === '') return;
    const cur = next[key];
    const curEmpty = cur == null || (typeof cur === 'string' && !cur.trim());
    if (mode === 'fill' && !curEmpty) return;
    if (mode === 'review' && cur === value) return;
    (next as Record<string, unknown>)[key] = value;
    changedFields.push(String(key));
  };

  apply('customerName', patch.customerName);
  apply('customerPhone', patch.customerPhone);
  apply('address', patch.address);
  {
    const normalized = normalizePreferredDateOrNull(patch.preferredDate);
    if (normalized) apply('preferredDate', normalized);
  }
  {
    const t = patch.preferredTime == null ? null : String(patch.preferredTime).trim();
    if (t === '오전' || t === '오후' || t === '사이청소' || t === '조율' || t === '사이') {
      apply('preferredTime', t === '사이' ? '사이청소' : t);
    }
  }
  apply('serviceBalanceAmount', patch.serviceBalanceAmount);
  apply('areaPyeong', patch.areaPyeong);
  apply('roomCount', patch.roomCount);
  apply('bathroomCount', patch.bathroomCount);
  apply('balconyCount', patch.balconyCount);

  return { draft: next, changedFields };
}

/**
 * AI 본연의 역할: ① 원문 전체 문맥 파악 → ② 접수 항목 추출·교정
 * 규칙 draft는 힌트일 뿐, 문맥과 다르면 덮어쓴다 (review merge).
 */
export async function understandAndExtractQuickPasteWithAi(params: {
  rawText: string;
  draft: QuickPasteDraft;
  tenantId?: string;
  userId?: string | null;
}): Promise<{
  draft: QuickPasteDraft;
  applied: boolean;
  filledFields: string[];
  contextSummary: string | null;
  warnings: string[];
  failed: boolean;
}> {
  const system = [
    'You are an intake assistant for a Korean move-in / house cleaning company (청소비서).',
    'Your job has TWO steps — always do both:',
    '1) CONTEXT: Read the ENTIRE pasted chat/text. Understand who the customer is, when/where cleaning is, money (deposit/balance), area/pyeong, rooms (방·화장실·베란다).',
    '2) EXTRACT: From that understanding, fill structured intake fields. Prefer meaning over keyword hunting.',
    'Return JSON only with: contextSummary (Korean, 1-2 sentences), all draft fields, correctedFields (keys you changed vs hint draft), warnings (Korean, short, optional).',
    'Field rules:',
    '- serviceBalanceAmount: KRW integer = actual cleaning fee/balance (청소비용·잔금·결제금액). IGNORE promotional lines like "15만 원 상당 … 제공", 포함 서비스, ✔ checklists — those are NOT the fee.',
    '- 230,000원=230000. 23만원=230000. Never ×10 on comma amounts.',
    '- customerPhone: 010-xxxx-xxxx.',
    '- preferredDate: YYYY-MM-DD only. Never YYMMDD like 260406.',
    `- Date examples: ${QUICK_PASTE_DATE_AI_EXAMPLES}`,
    `- Name examples: ${QUICK_PASTE_NAME_AI_EXAMPLES}`,
    '- preferredTime: only 오전 | 오후 | 사이청소 | 조율. "사이" → 사이청소.',
    '- areaPyeong + rooms: "25평(3/2/1)" means pyeong=25, room=3, bathroom=2, balcony=1. Do NOT invent "방3화2베1" unless that exact text exists.',
    '- 방3화5베1 (only if written that way): room 3, bathroom 5, balcony 1.',
    'The hint draft may be wrong — if your reading of the full text disagrees, overwrite the hint.',
    'Use null only when the text truly has no info.',
  ].join(' ');

  const user = [
    'Step 1: Understand the full message.',
    'Step 2: Extract intake fields from that understanding.',
    'Hint draft (rules/learned — may be incomplete or wrong):',
    JSON.stringify(params.draft),
    '--- full pasted text ---',
    params.rawText.slice(0, 6000),
  ].join('\n');

  const log =
    params.tenantId != null
      ? {
          context: { tenantId: params.tenantId, userId: params.userId ?? null },
          operation: 'understand' as const,
        }
      : undefined;

  const raw = await callQuickPasteOpenAiJson(system, user, log);
  if (!raw) {
    return {
      draft: params.draft,
      applied: false,
      filledFields: [],
      contextSummary: null,
      warnings: [],
      failed: true,
    };
  }

  const patch = raw as AiUnderstandJson;
  const merged = mergeAiPatch(params.draft, patch, 'review');
  const contextSummary =
    typeof patch.contextSummary === 'string' && patch.contextSummary.trim()
      ? patch.contextSummary.trim().slice(0, 280)
      : null;
  const warnings = Array.isArray(patch.warnings)
    ? patch.warnings.filter((w): w is string => typeof w === 'string').slice(0, 5)
    : [];

  return {
    draft: merged.draft,
    applied: merged.changedFields.length > 0 || Boolean(contextSummary),
    filledFields: merged.changedFields,
    contextSummary,
    warnings,
    failed: false,
  };
}

/** @deprecated — 문맥 파악 경로로 통합. 호환용 래퍼 */
export async function enhanceQuickPasteWithAi(params: {
  rawText: string;
  draft: QuickPasteDraft;
  missingFields: QuickPasteFieldKey[];
  optionalAiHints: QuickPasteOptionalFieldKey[];
  tenantId?: string;
  userId?: string | null;
}): Promise<{ draft: QuickPasteDraft; applied: boolean; filledFields: string[] }> {
  void params.missingFields;
  void params.optionalAiHints;
  const r = await understandAndExtractQuickPasteWithAi({
    rawText: params.rawText,
    draft: params.draft,
    tenantId: params.tenantId,
    userId: params.userId,
  });
  return { draft: r.draft, applied: r.applied, filledFields: r.filledFields };
}

/** 가벼운 2차 검수 — 금액·날짜만 (문맥 추출 이후) */
export async function reviewQuickPasteDraftWithAi(params: {
  rawText: string;
  draft: QuickPasteDraft;
  tenantId?: string;
  userId?: string | null;
}): Promise<{
  draft: QuickPasteDraft;
  reviewed: boolean;
  reviewFailed: boolean;
  correctedFields: string[];
  warnings: string[];
}> {
  const system = [
    'QA check after full-context extraction for Korean cleaning intake.',
    'Re-read the full raw text. Fix only clear mistakes vs the text (especially money ×10 and wrong dates).',
    'preferredDate must be YYYY-MM-DD. 25평(3/2/1) → area 25, rooms 3/2/1 — do not invent 방N화N베N text.',
    'Return JSON: all draft fields + correctedFields + warnings (Korean).',
  ].join(' ');

  const user = [
    'Verify draft against full raw text. Fix only if clearly wrong.',
    'Draft:',
    JSON.stringify(params.draft),
    '--- raw ---',
    params.rawText.slice(0, 6000),
  ].join('\n');

  const log =
    params.tenantId != null
      ? {
          context: { tenantId: params.tenantId, userId: params.userId ?? null },
          operation: 'review' as const,
        }
      : undefined;

  const raw = await callQuickPasteOpenAiJson(system, user, log);
  if (!raw) {
    return { draft: params.draft, reviewed: false, reviewFailed: true, correctedFields: [], warnings: [] };
  }

  const patch = raw as AiUnderstandJson;
  const merged = mergeAiPatch(params.draft, patch, 'review');
  const warnings = Array.isArray(patch.warnings)
    ? patch.warnings.filter((w): w is string => typeof w === 'string').slice(0, 5)
    : [];

  return {
    draft: merged.draft,
    reviewed: true,
    reviewFailed: false,
    correctedFields: merged.changedFields,
    warnings,
  };
}
