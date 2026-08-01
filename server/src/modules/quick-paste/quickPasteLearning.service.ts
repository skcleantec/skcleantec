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
  console.info('[quick-paste] learning log saved', {
    tenantId: opts.tenantId,
    inquiryId: opts.inquiryId,
    userEditedFields: opts.userEditedFields,
    aiApplied: opts.aiApplied,
    missingAfterRule: opts.missingAfterRule,
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
): Promise<Array<{ fieldKey: string; pattern: string; created: boolean }>> {
  const learned: Array<{ fieldKey: string; pattern: string; created: boolean }> = [];
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

    const row = await upsertLearnedQuickPasteRule(db, opts.tenantId, key, label);
    if (row) learned.push({ fieldKey: row.fieldKey, pattern: row.pattern, created: row.created });
  }
  if (learned.length > 0) {
    console.info('[quick-paste] learn from commit', { tenantId: opts.tenantId, learned });
  }
  return learned;
}

export type QuickPasteLearnedRuleRow = {
  id: string;
  fieldKey: string;
  ruleType: string;
  pattern: string;
  hitCount: number;
  source: string;
  createdAt: string;
  updatedAt: string;
};

export type QuickPasteLearningLogRow = {
  id: string;
  inquiryId: string | null;
  textHash: string;
  textLength: number;
  missingAfterRule: string[];
  aiApplied: boolean;
  aiFilledFields: string[];
  userEditedFields: string[];
  createdAt: string;
};

export async function listQuickPasteLearnedRules(
  db: PrismaClient,
  tenantId: string,
  opts?: { limit?: number; source?: string },
): Promise<QuickPasteLearnedRuleRow[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 50, 1), 200);
  const rows = await db.quickPasteTenantRule.findMany({
    where: {
      tenantId,
      ...(opts?.source ? { source: opts.source } : {}),
    },
    orderBy: [{ updatedAt: 'desc' }, { hitCount: 'desc' }],
    take: limit,
    select: {
      id: true,
      fieldKey: true,
      ruleType: true,
      pattern: true,
      hitCount: true,
      source: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  return rows.map((row) => ({
    ...row,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }));
}

export async function listQuickPasteLearningLogs(
  db: PrismaClient,
  tenantId: string,
  opts?: { limit?: number },
): Promise<QuickPasteLearningLogRow[]> {
  const limit = Math.min(Math.max(opts?.limit ?? 30, 1), 100);
  const rows = await db.quickPasteLearningLog.findMany({
    where: { tenantId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      inquiryId: true,
      textHash: true,
      textLength: true,
      missingAfterRule: true,
      aiApplied: true,
      aiFilledFields: true,
      userEditedFields: true,
      createdAt: true,
    },
  });
  return rows.map((row) => ({
    id: row.id,
    inquiryId: row.inquiryId,
    textHash: row.textHash,
    textLength: row.textLength,
    missingAfterRule: Array.isArray(row.missingAfterRule)
      ? row.missingAfterRule.filter((x): x is string => typeof x === 'string')
      : [],
    aiApplied: row.aiApplied,
    aiFilledFields: Array.isArray(row.aiFilledFields)
      ? row.aiFilledFields.filter((x): x is string => typeof x === 'string')
      : [],
    userEditedFields: Array.isArray(row.userEditedFields)
      ? row.userEditedFields.filter((x): x is string => typeof x === 'string')
      : [],
    createdAt: row.createdAt.toISOString(),
  }));
}
