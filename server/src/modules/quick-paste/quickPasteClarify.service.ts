import type { PrismaClient } from '@prisma/client';
import {
  QUICK_PASTE_FIELD_LABELS,
  type QuickPasteFieldKey,
} from './quickPaste.constants.js';
import type { QuickPasteDraft } from './quickPasteParse.service.js';
import { callQuickPasteOpenAiJson, isQuickPasteAiConfigured } from './quickPasteAi.service.js';
import {
  applyQuickPasteTenantRules,
  upsertLearnedQuickPasteRule,
} from './quickPasteTenantRules.service.js';

const FIELD_KEY_SET = new Set<string>(Object.keys(QUICK_PASTE_FIELD_LABELS));

function applyLabelValueRule(text: string, label: string): string | null {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const re = new RegExp(`${escaped}\\s*[:：]?\\s*([^\\n\\r]{1,120})`, 'i');
  const m = text.match(re);
  return m?.[1]?.trim() ?? null;
}

function guessFieldKeyFromText(text: string): QuickPasteFieldKey | null {
  const t = text.replace(/\s/g, '');
  if (/고객명|고객이름|성함|이름|예약자|의뢰인/.test(t)) return 'customerName';
  if (/연락처|전화|휴대폰|핸드폰|번호/.test(t)) return 'customerPhone';
  if (/주소|현장|청소주소/.test(t)) return 'address';
  if (/희망일|청소일|일정|날짜|입주|이사/.test(t)) return 'preferredDate';
  if (/잔금|청소비|금액|결제|당일/.test(t)) return 'serviceBalanceAmount';
  if (/평수|평형|평/.test(t)) return 'areaPyeong';
  return null;
}

function coerceClarifyValue(fieldKey: QuickPasteFieldKey, raw: string): string | number | null {
  const s = raw.trim();
  if (!s) return null;
  if (fieldKey === 'serviceBalanceAmount' || fieldKey === 'areaPyeong') {
    const n = Number(s.replace(/,/g, '').replace(/[^\d.]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return s.slice(0, fieldKey === 'address' ? 512 : 120);
}

function patchDraftField(
  draft: QuickPasteDraft,
  fieldKey: QuickPasteFieldKey,
  value: string | number | null,
): QuickPasteDraft {
  if (value == null) return draft;
  return { ...draft, [fieldKey]: value } as QuickPasteDraft;
}

export type ClarifyAskResult = {
  fieldKey: QuickPasteFieldKey;
  fieldLabel: string;
  question: string;
  snippet: string | null;
  sourceLabel: string | null;
  aiAvailable: boolean;
};

export type ClarifyRespondResult = {
  fieldKey: QuickPasteFieldKey;
  confirmation: string;
  learnedLabel: string | null;
  value: string | number | null;
  draft: QuickPasteDraft;
  learnedRule: {
    id: string;
    fieldKey: string;
    pattern: string;
    created: boolean;
  } | null;
};

export async function askQuickPasteMissingField(
  rawText: string,
  draft: QuickPasteDraft,
  fieldKey: QuickPasteFieldKey,
  log?: { tenantId: string; userId?: string | null },
): Promise<ClarifyAskResult> {
  const fieldLabel = QUICK_PASTE_FIELD_LABELS[fieldKey];
  const text = rawText.trim();
  const aiAvailable = isQuickPasteAiConfigured();

  if (aiAvailable) {
    const system = [
      'Staff maps Korean cleaning-service chat paste to structured fields.',
      `Missing field key: ${fieldKey} (${fieldLabel}).`,
      'Find one line/snippet in raw text that likely holds this value but was not understood.',
      'Return JSON: question (Korean, polite, cites snippet), snippet (exact substring), sourceLabel (label before colon e.g. 예약자).',
    ].join(' ');

    const raw = await callQuickPasteOpenAiJson(
      system,
      ['Draft:', JSON.stringify(draft), '--- raw ---', text.slice(0, 6000)].join('\n'),
      log ? { context: { tenantId: log.tenantId, userId: log.userId ?? null }, operation: 'clarify_ask' } : undefined,
    );

    if (raw) {
      const question = typeof raw.question === 'string' ? raw.question.trim() : '';
      const snippet = typeof raw.snippet === 'string' ? raw.snippet.trim() : null;
      const sourceLabel = typeof raw.sourceLabel === 'string' ? raw.sourceLabel.trim() : null;
      if (question) {
        return {
          fieldKey,
          fieldLabel,
          question,
          snippet: snippet || null,
          sourceLabel: sourceLabel || null,
          aiAvailable: true,
        };
      }
    }
  }

  return {
    fieldKey,
    fieldLabel,
    question: `「${fieldLabel}」을(를) 찾지 못했어요. 원문에서 어떤 표기로 적혀 있나요? (예: 예약자, 성함)`,
    snippet: null,
    sourceLabel: null,
    aiAvailable,
  };
}

export async function respondQuickPasteMissingField(
  db: PrismaClient,
  tenantId: string,
  params: {
    rawText: string;
    draft: QuickPasteDraft;
    fieldKey: QuickPasteFieldKey;
    userAnswer: string;
    snippet?: string | null;
    sourceLabel?: string | null;
    userId?: string | null;
  },
): Promise<ClarifyRespondResult> {
  const text = params.rawText.trim();
  const answer = params.userAnswer.trim();
  const targetLabel = QUICK_PASTE_FIELD_LABELS[params.fieldKey];
  let fieldKey = params.fieldKey;
  let learnedLabel: string | null = params.sourceLabel?.trim() || null;
  let extracted: string | number | null = null;
  let confirmation = '';

  if (isQuickPasteAiConfigured()) {
    const system = [
      'User teaches how their chat paste labels map to intake fields.',
      `Expected missing field: ${params.fieldKey} (${targetLabel}).`,
      'Fields: customerName, customerPhone, address, preferredDate, serviceBalanceAmount, areaPyeong.',
      'Return JSON: fieldKey, learnedLabel (Korean label to remember e.g. 예약자), extractedValue, confirmation (Korean, friendly, e.g. 아, 「예약자」가 고객명이군요.).',
    ].join(' ');

    const raw = await callQuickPasteOpenAiJson(
      system,
      [
        `User answer: ${answer}`,
        params.snippet ? `Snippet: ${params.snippet}` : '',
        params.sourceLabel ? `Source label: ${params.sourceLabel}` : '',
        '--- raw ---',
        text.slice(0, 6000),
      ]
        .filter(Boolean)
        .join('\n'),
      {
        context: { tenantId, userId: params.userId ?? null },
        operation: 'clarify_respond',
      },
    );

    if (raw) {
      const aiField =
        typeof raw.fieldKey === 'string' && FIELD_KEY_SET.has(raw.fieldKey)
          ? (raw.fieldKey as QuickPasteFieldKey)
          : fieldKey;
      fieldKey = aiField;
      learnedLabel =
        (typeof raw.learnedLabel === 'string' && raw.learnedLabel.trim()) ||
        learnedLabel ||
        answer.replace(/[입니다다요\.]/g, '').trim().slice(0, 12);
      const ev = raw.extractedValue;
      if (typeof ev === 'string' || typeof ev === 'number') {
        extracted = coerceClarifyValue(fieldKey, String(ev));
      }
      confirmation =
        typeof raw.confirmation === 'string' && raw.confirmation.trim()
          ? raw.confirmation.trim()
          : `「${learnedLabel}」를 ${QUICK_PASTE_FIELD_LABELS[fieldKey]}(으)로 기억할게요.`;
    }
  }

  if (!confirmation) {
    const guessed = guessFieldKeyFromText(answer);
    if (guessed) fieldKey = guessed;
    learnedLabel =
      learnedLabel ||
      answer
        .replace(/(고객명|고객이름|성함|연락처|주소|희망일|잔금|평수|이름|이야|입니다|이에요|예요)/g, '')
        .trim()
        .slice(0, 12) ||
      answer.slice(0, 12);
    confirmation = `「${learnedLabel}」를 ${QUICK_PASTE_FIELD_LABELS[fieldKey]}(으)로 기억할게요.`;
  }

  let learnedRule: ClarifyRespondResult['learnedRule'] = null;
  if (learnedLabel) {
    const row = await upsertLearnedQuickPasteRule(db, tenantId, fieldKey, learnedLabel);
    if (row) {
      learnedRule = {
        id: row.id,
        fieldKey: row.fieldKey,
        pattern: row.pattern,
        created: row.created,
      };
    }
    const fromLabel = applyLabelValueRule(text, learnedLabel);
    if (fromLabel) extracted = coerceClarifyValue(fieldKey, fromLabel);
  }

  if (extracted == null && params.snippet) {
    const colon = params.snippet.match(/[:：]\s*(.+)$/);
    if (colon?.[1]) extracted = coerceClarifyValue(fieldKey, colon[1]);
  }

  let draft = patchDraftField(params.draft, fieldKey, extracted);

  const rulesApplied = await applyQuickPasteTenantRules(db, tenantId, text, draft);
  draft = rulesApplied.draft;

  const finalVal = draft[fieldKey];
  if (finalVal != null && confirmation && !confirmation.includes(String(finalVal))) {
    confirmation = `${confirmation} → ${String(finalVal)}`;
  }

  return {
    fieldKey,
    confirmation,
    learnedLabel,
    value: finalVal as string | number | null,
    draft,
    learnedRule,
  };
}
