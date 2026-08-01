import type {
  QuickPasteFieldKey,
  QuickPasteOptionalFieldKey,
} from './quickPaste.constants.js';
import {
  QUICK_PASTE_FIELD_LABELS,
  QUICK_PASTE_OPTIONAL_FIELD_LABELS,
} from './quickPaste.constants.js';
import type { QuickPasteDraft } from './quickPasteParse.service.js';

const OPENAI_API_KEY = () =>
  (process.env.QUICK_PASTE_OPENAI_API_KEY || process.env.OPENAI_API_KEY || '').trim();
const OPENAI_MODEL = () => process.env.QUICK_PASTE_AI_MODEL?.trim() || 'gpt-4o-mini';

export function isQuickPasteAiConfigured(): boolean {
  return OPENAI_API_KEY().length > 0;
}

function shouldRunQuickPasteFill(
  missingFields: QuickPasteFieldKey[],
  optionalAiHints: QuickPasteOptionalFieldKey[],
): boolean {
  return missingFields.length > 0 || optionalAiHints.length > 0;
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

type AiReviewJson = AiDraftJson & {
  correctedFields?: string[];
  warnings?: string[];
};

export async function callQuickPasteOpenAiJson(
  system: string,
  user: string,
): Promise<Record<string, unknown> | null> {
  if (!isQuickPasteAiConfigured()) return null;
  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: OPENAI_MODEL(),
        temperature: 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
      }),
    });
    if (!res.ok) {
      console.error('[quick-paste] AI HTTP', res.status, await res.text().catch(() => ''));
      return null;
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;
    return JSON.parse(content) as Record<string, unknown>;
  } catch (e) {
    console.error('[quick-paste] AI error', e);
    return null;
  }
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
  apply('preferredDate', patch.preferredDate);
  apply('preferredTime', patch.preferredTime);
  apply('serviceBalanceAmount', patch.serviceBalanceAmount);
  apply('areaPyeong', patch.areaPyeong);
  apply('roomCount', patch.roomCount);
  apply('bathroomCount', patch.bathroomCount);
  apply('balconyCount', patch.balconyCount);

  return { draft: next, changedFields };
}

/** 1단계 — 빈 필드·선택 힌트 보조 채움 */
export async function enhanceQuickPasteWithAi(params: {
  rawText: string;
  draft: QuickPasteDraft;
  missingFields: QuickPasteFieldKey[];
  optionalAiHints: QuickPasteOptionalFieldKey[];
}): Promise<{ draft: QuickPasteDraft; applied: boolean; filledFields: string[] }> {
  if (!shouldRunQuickPasteFill(params.missingFields, params.optionalAiHints)) {
    return { draft: params.draft, applied: false, filledFields: [] };
  }

  const needLabels = [
    ...params.missingFields.map((k) => QUICK_PASTE_FIELD_LABELS[k]),
    ...params.optionalAiHints.map((k) => QUICK_PASTE_OPTIONAL_FIELD_LABELS[k]),
  ];

  const system = [
    'Extract Korean cleaning-service intake fields from chat paste.',
    'Return JSON only. Use null for unknown.',
    'serviceBalanceAmount: KRW integer. 230,000원 = 230000. 23만원 = 230000. Never multiply comma amounts by 10.',
    'customerPhone: 010-xxxx-xxxx. preferredDate: YYYY-MM-DD.',
    'roomCount/bathroomCount/balconyCount: 방3화5베1 means room 3, bathroom 5, balcony 1 (화=화장실, 베=베란다).',
  ].join(' ');

  const user = [
    `Fill if present: ${needLabels.join(', ')}`,
    'Current draft:',
    JSON.stringify(params.draft),
    '--- raw ---',
    params.rawText.slice(0, 6000),
  ].join('\n');

  const raw = await callQuickPasteOpenAiJson(system, user);
  if (!raw) return { draft: params.draft, applied: false, filledFields: [] };
  const merged = mergeAiPatch(params.draft, raw as AiDraftJson, 'fill');
  return {
    draft: merged.draft,
    applied: merged.changedFields.length > 0,
    filledFields: merged.changedFields,
  };
}

/** 2단계 — 최종 검토·교정 (금액 10배 오류 등) */
export async function reviewQuickPasteDraftWithAi(params: {
  rawText: string;
  draft: QuickPasteDraft;
}): Promise<{
  draft: QuickPasteDraft;
  reviewed: boolean;
  reviewFailed: boolean;
  correctedFields: string[];
  warnings: string[];
}> {
  const system = [
    'You are a QA reviewer for Korean cleaning-service intake extraction.',
    'Compare draft JSON to raw text. Fix wrong values, especially serviceBalanceAmount.',
    '230,000원 or 230000원 must be serviceBalanceAmount 230000 — NOT 2300000.',
    '23만원 = 230000. Only multiply by 10000 when text explicitly says 만.',
    '방3화5베1: roomCount 3, bathroomCount 5, balconyCount 1 — never swap or drop digits from compact notation.',
    'Return JSON: all draft fields + correctedFields (array of changed keys) + warnings (Korean, short).',
  ].join(' ');

  const user = [
    'Verify and correct this draft against the raw text.',
    'Draft:',
    JSON.stringify(params.draft),
    '--- raw ---',
    params.rawText.slice(0, 6000),
  ].join('\n');

  const raw = await callQuickPasteOpenAiJson(system, user);
  if (!raw) {
    return { draft: params.draft, reviewed: false, reviewFailed: true, correctedFields: [], warnings: [] };
  }

  const patch = raw as AiReviewJson;
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
