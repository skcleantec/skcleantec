import type { PrismaClient } from '@prisma/client';
import type { QuickPasteFieldKey } from './quickPaste.constants.js';
import {
  parseQuickPasteText,
  buildQuickPasteResult,
  applyCompactRhbCounts,
  type QuickPasteDraft,
  type QuickPasteParseResult,
} from './quickPasteParse.service.js';
import { applyQuickPasteTenantRules } from './quickPasteTenantRules.service.js';
import {
  enhanceQuickPasteWithAi,
  isQuickPasteAiConfigured,
  reviewQuickPasteDraftWithAi,
} from './quickPasteAi.service.js';
import { applyLocalBalanceSanityCheck } from './quickPasteAmount.helpers.js';

export type QuickPasteEnrichedParseResult = QuickPasteParseResult & {
  ruleDraft: QuickPasteDraft;
  missingAfterRule: QuickPasteFieldKey[];
  tenantRulesApplied: number;
  aiApplied: boolean;
  aiAvailable: boolean;
  aiFilledFields: string[];
  aiReviewed: boolean;
  aiCorrectedFields: string[];
  aiWarnings: string[];
};

function applyLocalSanity(trimmed: string, draft: QuickPasteDraft): {
  draft: QuickPasteDraft;
  correctedFields: string[];
} {
  const sanity = applyLocalBalanceSanityCheck(trimmed, draft.serviceBalanceAmount);
  if (!sanity.corrected || sanity.value == null) {
    return { draft, correctedFields: [] };
  }
  return {
    draft: { ...draft, serviceBalanceAmount: sanity.value },
    correctedFields: ['serviceBalanceAmount'],
  };
}

export async function parseQuickPasteForTenant(
  db: PrismaClient,
  tenantId: string,
  rawText: string,
): Promise<QuickPasteEnrichedParseResult> {
  const trimmed = rawText.trim();
  const ruleResult = parseQuickPasteText(trimmed);
  const ruleDraft = { ...ruleResult.draft };

  const tenantApplied = await applyQuickPasteTenantRules(db, tenantId, trimmed, ruleDraft);
  let draft = tenantApplied.draft;
  let result = buildQuickPasteResult(trimmed, draft);
  const missingAfterRule = [...result.missingFields];

  let aiApplied = false;
  let aiFilledFields: string[] = [];
  let aiReviewed = false;
  let aiCorrectedFields: string[] = [];
  let aiWarnings: string[] = [];
  const aiAvailable = isQuickPasteAiConfigured();

  if (aiAvailable && (result.missingFields.length > 0 || result.optionalAiHints.length > 0)) {
    const ai = await enhanceQuickPasteWithAi({
      rawText: trimmed,
      draft,
      missingFields: result.missingFields,
      optionalAiHints: result.optionalAiHints,
    });
    draft = ai.draft;
    aiApplied = ai.applied;
    aiFilledFields = ai.filledFields;
    result = buildQuickPasteResult(trimmed, draft);
  }

  const localFix = applyLocalSanity(trimmed, draft);
  if (localFix.correctedFields.length > 0) {
    draft = localFix.draft;
    aiCorrectedFields = [...localFix.correctedFields];
    result = buildQuickPasteResult(trimmed, draft);
  }

  if (aiAvailable) {
    const review = await reviewQuickPasteDraftWithAi({ rawText: trimmed, draft });
    draft = review.draft;
    aiReviewed = review.reviewed;
    aiCorrectedFields = [...new Set([...aiCorrectedFields, ...review.correctedFields])];
    aiWarnings = review.warnings;
    if (review.reviewFailed) {
      aiWarnings = [
        'OpenAI API 호출 실패 — 크레딧·결제가 없거나 모델명이 맞지 않을 수 있습니다. platform.openai.com → Billing 확인.',
        ...aiWarnings,
      ];
    }
    if (review.correctedFields.length > 0) aiApplied = true;
    result = buildQuickPasteResult(trimmed, draft);
  }

  draft = applyCompactRhbCounts(trimmed, draft);
  result = buildQuickPasteResult(trimmed, draft);

  return {
    ...result,
    ruleDraft,
    missingAfterRule,
    tenantRulesApplied: tenantApplied.appliedRuleIds.length,
    aiApplied,
    aiAvailable,
    aiFilledFields,
    aiReviewed,
    aiCorrectedFields,
    aiWarnings,
  };
}
