import type { PrismaClient } from '@prisma/client';
import type { QuickPasteFieldKey } from './quickPaste.constants.js';
import {
  parseQuickPasteText,
  buildQuickPasteResult,
  type QuickPasteDraft,
  type QuickPasteParseResult,
} from './quickPasteParse.service.js';
import { applyQuickPasteTenantRules } from './quickPasteTenantRules.service.js';
import { enhanceQuickPasteWithAi, isQuickPasteAiConfigured } from './quickPasteAi.service.js';

export type QuickPasteEnrichedParseResult = QuickPasteParseResult & {
  ruleDraft: QuickPasteDraft;
  missingAfterRule: QuickPasteFieldKey[];
  tenantRulesApplied: number;
  aiApplied: boolean;
  aiAvailable: boolean;
  aiFilledFields: string[];
};

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

  return {
    ...result,
    ruleDraft,
    missingAfterRule,
    tenantRulesApplied: tenantApplied.appliedRuleIds.length,
    aiApplied,
    aiAvailable,
    aiFilledFields,
  };
}
