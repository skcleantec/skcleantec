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
  isQuickPasteAiConfigured,
  reviewQuickPasteDraftWithAi,
  understandAndExtractQuickPasteWithAi,
} from './quickPasteAi.service.js';
import { applyLocalBalanceSanityCheck } from './quickPasteAmount.helpers.js';
import { normalizePreferredDateOrNull } from './quickPasteDate.helpers.js';
import {
  buildRuleFieldEvidence,
  evidenceForFilledDraft,
  mergeFieldEvidence,
  type QuickPasteFieldEvidenceMap,
} from './quickPasteEvidence.helpers.js';

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
  /** AI가 원문 전체를 읽고 요약한 문맥 (1~2문장) */
  aiContextSummary: string | null;
  fieldEvidence: QuickPasteFieldEvidenceMap;
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

function guardPreferredDate(draft: QuickPasteDraft): QuickPasteDraft {
  if (draft.preferredDate == null) return draft;
  const normalized = normalizePreferredDateOrNull(draft.preferredDate);
  if (normalized === draft.preferredDate) return draft;
  return { ...draft, preferredDate: normalized };
}

/**
 * 파이프라인:
 * 1) 규칙·학습 → 힌트 draft
 * 2) AI: 전체 문맥 파악 → 항목 찾기·교정 (항상, API 있을 때)
 * 3) 로컬 금액 가드
 * 4) AI 가벼운 2차 검수
 */
export async function parseQuickPasteForTenant(
  db: PrismaClient,
  tenantId: string,
  rawText: string,
  userId?: string | null,
): Promise<QuickPasteEnrichedParseResult> {
  const trimmed = rawText.trim();
  const ruleResult = parseQuickPasteText(trimmed);
  const ruleDraft = { ...ruleResult.draft };
  let fieldEvidence = buildRuleFieldEvidence(trimmed, ruleDraft);

  const tenantApplied = await applyQuickPasteTenantRules(db, tenantId, trimmed, ruleDraft);
  let draft = tenantApplied.draft;
  if (tenantApplied.appliedRuleIds.length > 0) {
    const tenantFilled = (Object.keys(draft) as Array<keyof QuickPasteDraft>).filter((k) => {
      const before = ruleDraft[k];
      const after = draft[k];
      const beforeEmpty = before == null || (typeof before === 'string' && !String(before).trim());
      const afterEmpty = after == null || (typeof after === 'string' && !String(after).trim());
      return beforeEmpty && !afterEmpty;
    }) as string[];
    fieldEvidence = mergeFieldEvidence(fieldEvidence, draft, tenantFilled, 'tenant_rule', trimmed);
  }

  let result = buildQuickPasteResult(trimmed, draft);
  const missingAfterRule = [...result.missingFields];

  let aiApplied = false;
  let aiFilledFields: string[] = [];
  let aiReviewed = false;
  let aiCorrectedFields: string[] = [];
  let aiWarnings: string[] = [];
  let aiContextSummary: string | null = null;
  const aiAvailable = isQuickPasteAiConfigured();

  // AI 본연: 빈 칸이 있어도/없어도 원문 전체를 읽고 추출
  if (aiAvailable) {
    const understood = await understandAndExtractQuickPasteWithAi({
      rawText: trimmed,
      draft,
      tenantId,
      userId,
    });
    draft = guardPreferredDate(understood.draft);
    aiContextSummary = understood.contextSummary;
    aiFilledFields = understood.filledFields;
    if (understood.filledFields.length > 0) {
      aiApplied = true;
      fieldEvidence = mergeFieldEvidence(fieldEvidence, draft, understood.filledFields, 'ai', trimmed);
    }
    if (understood.warnings.length > 0) {
      aiWarnings = [...understood.warnings];
    }
    if (understood.failed) {
      aiWarnings = [
        'OpenAI API 호출 실패 — 크레딧·결제가 없거나 모델명이 맞지 않을 수 있습니다. platform.openai.com → Billing 확인.',
        ...aiWarnings,
      ];
    } else if (understood.contextSummary || understood.filledFields.length > 0) {
      aiApplied = true;
    }
    result = buildQuickPasteResult(trimmed, draft);
  }

  const localFix = applyLocalSanity(trimmed, draft);
  if (localFix.correctedFields.length > 0) {
    draft = localFix.draft;
    aiCorrectedFields = [...localFix.correctedFields];
    fieldEvidence = mergeFieldEvidence(
      fieldEvidence,
      draft,
      localFix.correctedFields,
      'rule',
      trimmed,
    );
    result = buildQuickPasteResult(trimmed, draft);
  }

  // 2차: 금액·날짜 등 명확한 오류만
  if (aiAvailable) {
    const review = await reviewQuickPasteDraftWithAi({
      rawText: trimmed,
      draft,
      tenantId,
      userId,
    });
    draft = guardPreferredDate(review.draft);
    aiReviewed = review.reviewed;
    aiCorrectedFields = [...new Set([...aiCorrectedFields, ...review.correctedFields])];
    aiWarnings = [...aiWarnings, ...review.warnings];
    if (review.reviewFailed && !aiContextSummary) {
      aiWarnings = [
        'OpenAI API 호출 실패 — 크레딧·결제가 없거나 모델명이 맞지 않을 수 있습니다. platform.openai.com → Billing 확인.',
        ...aiWarnings,
      ];
    }
    if (review.correctedFields.length > 0) {
      aiApplied = true;
      fieldEvidence = mergeFieldEvidence(
        fieldEvidence,
        draft,
        review.correctedFields,
        'ai',
        trimmed,
      );
    }
    result = buildQuickPasteResult(trimmed, draft);
  }

  draft = applyCompactRhbCounts(trimmed, draft);
  draft = guardPreferredDate(draft);
  result = buildQuickPasteResult(trimmed, draft);
  fieldEvidence = evidenceForFilledDraft(draft, fieldEvidence, trimmed);

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
    aiContextSummary,
    fieldEvidence,
  };
}
