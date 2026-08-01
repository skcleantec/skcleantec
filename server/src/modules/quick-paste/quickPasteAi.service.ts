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

export function shouldRunQuickPasteAi(
  missingFields: QuickPasteFieldKey[],
  optionalAiHints: QuickPasteOptionalFieldKey[],
): boolean {
  return missingFields.length > 0 || optionalAiHints.length > 0;
}

type AiResponseJson = {
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

function mergeAiPatch(draft: QuickPasteDraft, patch: AiResponseJson): {
  draft: QuickPasteDraft;
  filledFields: string[];
} {
  const next: QuickPasteDraft = { ...draft };
  const filledFields: string[] = [];
  const setIfEmpty = (key: keyof QuickPasteDraft, value: unknown) => {
    const cur = next[key];
    if (cur != null && (typeof cur !== 'string' || cur.trim())) return;
    if (value == null || value === '') return;
    (next as Record<string, unknown>)[key] = value;
    filledFields.push(String(key));
  };

  setIfEmpty('customerName', patch.customerName);
  setIfEmpty('customerPhone', patch.customerPhone);
  setIfEmpty('address', patch.address);
  setIfEmpty('preferredDate', patch.preferredDate);
  setIfEmpty('preferredTime', patch.preferredTime);
  setIfEmpty('serviceBalanceAmount', patch.serviceBalanceAmount);
  setIfEmpty('areaPyeong', patch.areaPyeong);
  setIfEmpty('roomCount', patch.roomCount);
  setIfEmpty('bathroomCount', patch.bathroomCount);
  setIfEmpty('balconyCount', patch.balconyCount);

  return { draft: next, filledFields };
}

export async function enhanceQuickPasteWithAi(params: {
  rawText: string;
  draft: QuickPasteDraft;
  missingFields: QuickPasteFieldKey[];
  optionalAiHints: QuickPasteOptionalFieldKey[];
}): Promise<{ draft: QuickPasteDraft; applied: boolean; filledFields: string[] }> {
  if (!isQuickPasteAiConfigured()) {
    return { draft: params.draft, applied: false, filledFields: [] };
  }
  if (!shouldRunQuickPasteAi(params.missingFields, params.optionalAiHints)) {
    return { draft: params.draft, applied: false, filledFields: [] };
  }

  const needLabels = [
    ...params.missingFields.map((k) => QUICK_PASTE_FIELD_LABELS[k]),
    ...params.optionalAiHints.map((k) => QUICK_PASTE_OPTIONAL_FIELD_LABELS[k]),
  ];

  const system = [
    'You extract structured fields from Korean cleaning-service chat paste text.',
    'Return JSON only. Use null for unknown fields.',
    'customerPhone: 010-xxxx-xxxx. preferredDate: YYYY-MM-DD (KST).',
    'serviceBalanceAmount: KRW integer (200000 not 20). areaPyeong: number.',
    'roomCount/bathroomCount/balconyCount: integers. (3,2,1) means room,bath,balcony.',
  ].join(' ');

  const user = [
    `Fill only these if present in text: ${needLabels.join(', ')}`,
    'Current draft JSON:',
    JSON.stringify(params.draft),
    '--- raw text ---',
    params.rawText.slice(0, 6000),
  ].join('\n');

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
      return { draft: params.draft, applied: false, filledFields: [] };
    }
    const data = (await res.json()) as {
      choices?: Array<{ message?: { content?: string } }>;
    };
    const content = data.choices?.[0]?.message?.content;
    if (!content) return { draft: params.draft, applied: false, filledFields: [] };
    const patch = JSON.parse(content) as AiResponseJson;
    const merged = mergeAiPatch(params.draft, patch);
    return {
      draft: merged.draft,
      applied: merged.filledFields.length > 0,
      filledFields: merged.filledFields,
    };
  } catch (e) {
    console.error('[quick-paste] AI error', e);
    return { draft: params.draft, applied: false, filledFields: [] };
  }
}
