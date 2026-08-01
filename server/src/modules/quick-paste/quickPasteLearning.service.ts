import { createHash } from 'node:crypto';
import type { PrismaClient } from '@prisma/client';
import type { QuickPasteFieldKey } from './quickPaste.constants.js';
import type { QuickPasteDraft } from './quickPasteParse.service.js';
import {
  extractLabelNearValue,
  upsertLearnedQuickPasteRule,
} from './quickPasteTenantRules.service.js';

const ALL_TRACKED_KEYS = [
  'customerName',
  'customerPhone',
  'address',
  'preferredDate',
  'serviceBalanceAmount',
  'areaPyeong',
  'roomCount',
  'bathroomCount',
  'balconyCount',
] as const;

export function hashQuickPasteText(rawText: string): string {
  return createHash('sha256').update(rawText.trim()).digest('hex');
}

function draftValue(draft: QuickPasteDraft, key: string): string {
  const v = draft[key as keyof QuickPasteDraft];
  if (v == null) return '';
  return String(v).trim();
}

export function diffQuickPasteDraftFields(
  before: QuickPasteDraft,
  after: QuickPasteDraft,
): string[] {
  const changed: string[] = [];
  for (const key of ALL_TRACKED_KEYS) {
    if (draftValue(before, key) !== draftValue(after, key)) changed.push(key);
  }
  return changed;
}

export async function logQuickPasteLearning(
  db: PrismaClient,
  opts: {
    tenantId: string;
    userId: string;
    inquiryId: string;
    rawText: string;
    ruleDraft: QuickPasteDraft;
    previewDraft: QuickPasteDraft;
    finalDraft: QuickPasteDraft;
    missingAfterRule: QuickPasteFieldKey[];
    aiApplied: boolean;
    aiFilledFields: string[];
    userEditedFields: string[];
  },
): Promise<void> {
  await db.quickPasteLearningLog.create({
    data: {
      tenantId: opts.tenantId,
      userId: opts.userId,
      inquiryId: opts.inquiryId,
      textHash: hashQuickPasteText(opts.rawText),
      textLength: opts.rawText.trim().length,
      ruleDraft: opts.ruleDraft as object,
      previewDraft: opts.previewDraft as object,
      finalDraft: opts.finalDraft as object,
      missingAfterRule: opts.missingAfterRule,
      aiApplied: opts.aiApplied,
      aiFilledFields: opts.aiFilledFields,
      userEditedFields: opts.userEditedFields,
    },
  });
}

export async function learnQuickPasteFromCommit(
  db: PrismaClient,
  opts: {
    tenantId: string;
    rawText: string;
    ruleDraft: QuickPasteDraft;
    previewDraft: QuickPasteDraft;
    finalDraft: QuickPasteDraft;
  },
): Promise<void> {
  const text = opts.rawText.trim();
  for (const key of ALL_TRACKED_KEYS) {
    const ruleVal = draftValue(opts.ruleDraft, key);
    const finalVal = draftValue(opts.finalDraft, key);
    if (!finalVal || ruleVal === finalVal) continue;

    const previewVal = draftValue(opts.previewDraft, key);
    const userCorrected = previewVal !== finalVal || (ruleVal === '' && finalVal !== '');
    if (!userCorrected) continue;

    const label = extractLabelNearValue(text, finalVal);
    if (!label) continue;

    await upsertLearnedQuickPasteRule(
      db,
      opts.tenantId,
      key,
      label,
    );
  }
}
