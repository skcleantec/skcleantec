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
  'preferredTime',
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

export type QuickPasteCorrectionInput = {
  fieldKey: string;
  wrongValue: string | null;
  correctValue: string;
  snippet?: string | null;
};

/**
 * 「틀림」교정 — 사용자가 AI/규칙 값이 틀렸다고 표시한 쌍을 학습.
 * 라벨은 snippet 또는 correctValue 근처에서 추출.
 */
export async function learnQuickPasteFromCorrections(
  db: PrismaClient,
  opts: {
    tenantId: string;
    rawText: string;
    corrections: QuickPasteCorrectionInput[];
  },
): Promise<Array<{ fieldKey: string; pattern: string; created: boolean; wrongValue: string | null }>> {
  const learned: Array<{
    fieldKey: string;
    pattern: string;
    created: boolean;
    wrongValue: string | null;
  }> = [];
  const text = opts.rawText.trim();

  for (const c of opts.corrections) {
    const correct = String(c.correctValue ?? '').trim();
    const wrong = c.wrongValue == null ? null : String(c.wrongValue).trim() || null;
    if (!correct || !ALL_TRACKED_KEYS.includes(c.fieldKey as (typeof ALL_TRACKED_KEYS)[number])) {
      continue;
    }
    if (wrong != null && wrong === correct) continue;

    const snippet = (c.snippet ?? '').trim();
    const label =
      extractLabelNearValue(snippet || text, correct) ||
      (snippet ? extractLabelNearValue(text, snippet.slice(0, 24)) : null) ||
      extractLabelNearValue(text, wrong ?? '');
    if (!label) {
      console.info('[quick-paste] correction skip — no label', {
        tenantId: opts.tenantId,
        fieldKey: c.fieldKey,
        wrong,
        correct,
      });
      continue;
    }

    const row = await upsertLearnedQuickPasteRule(db, opts.tenantId, c.fieldKey, label);
    if (row) {
      learned.push({
        fieldKey: row.fieldKey,
        pattern: row.pattern,
        created: row.created,
        wrongValue: wrong,
      });
      console.info('[quick-paste] correction learned', {
        tenantId: opts.tenantId,
        fieldKey: c.fieldKey,
        label: row.pattern,
        wrong,
        correct,
      });
    }
  }
  return learned;
}

export async function learnQuickPasteFromCommit(
  db: PrismaClient,
  opts: {
    tenantId: string;
    rawText: string;
    ruleDraft: QuickPasteDraft;
    previewDraft: QuickPasteDraft;
    finalDraft: QuickPasteDraft;
    /** 「틀림」으로 명시된 교정 — 있으면 이 경로를 우선 */
    corrections?: QuickPasteCorrectionInput[];
  },
): Promise<Array<{ fieldKey: string; pattern: string; created: boolean }>> {
  if (opts.corrections && opts.corrections.length > 0) {
    const fromCorrections = await learnQuickPasteFromCorrections(db, {
      tenantId: opts.tenantId,
      rawText: opts.rawText,
      corrections: opts.corrections,
    });
    return fromCorrections.map(({ fieldKey, pattern, created }) => ({ fieldKey, pattern, created }));
  }

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
