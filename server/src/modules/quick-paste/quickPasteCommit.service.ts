import { prisma } from '../../lib/prisma.js';
import { createInquiryFromBody, InquiryCreateError } from '../inquiries/inquiryCreate.service.js';
import { getTenantCoinSnapshot } from '../tenants/tenantCoin.service.js';
import { getTenantPlan } from '../tenants/tenantFeatures.service.js';
import { mergeQuickPasteDraft, validateQuickPasteDraft, type QuickPasteDraft } from './quickPasteParse.service.js';
import { QUICK_PASTE_COIN_COST } from './quickPaste.constants.js';
import { findQuickPastePhoneDuplicates } from './quickPasteDuplicate.service.js';
import { previewQuickPasteSoloAutoAssign, tryQuickPasteSoloAutoAssign } from './quickPasteAutoAssign.service.js';
import { parseQuickPasteForTenant } from './quickPasteOrchestrator.service.js';
import {
  diffQuickPasteDraftFields,
  learnQuickPasteFromCommit,
  logQuickPasteLearning,
  type QuickPasteCorrectionInput,
} from './quickPasteLearning.service.js';

export class QuickPasteValidationError extends Error {
  constructor(
    message: string,
    readonly missingFields?: string[],
  ) {
    super(message);
    this.name = 'QuickPasteValidationError';
  }
}

async function buildDuplicateAndSoloPreview(
  tenantId: string,
  actorUserId: string,
  customerPhone: string | null,
) {
  const [duplicateMatches, soloAutoAssign] = await Promise.all([
    customerPhone
      ? findQuickPastePhoneDuplicates({ db: prisma, tenantId, customerPhone })
      : Promise.resolve([]),
    previewQuickPasteSoloAutoAssign(prisma, tenantId, actorUserId),
  ]);
  return { duplicateMatches, soloAutoAssign };
}

export async function buildQuickPastePreview(rawText: string, tenantId: string, actorUserId: string) {
  const parsed = await parseQuickPasteForTenant(prisma, tenantId, rawText, actorUserId);
  const plan = await getTenantPlan(tenantId);
  const coins = await getTenantCoinSnapshot(prisma, tenantId, plan);
  const { duplicateMatches, soloAutoAssign } = await buildDuplicateAndSoloPreview(
    tenantId,
    actorUserId,
    parsed.draft.customerPhone,
  );

  return {
    ...parsed,
    specialNotes: rawText.trim(),
    coinCost: QUICK_PASTE_COIN_COST,
    duplicateMatches,
    soloAutoAssign,
    coins: {
      remaining: coins.remaining,
      unlimited: coins.unlimited,
      allowance: coins.allowance,
      spent: coins.spent,
      periodYm: coins.periodYm,
    },
  };
}

export type QuickPasteCommitSnapshot = {
  ruleDraft?: QuickPasteDraft;
  previewDraft?: QuickPasteDraft;
  aiApplied?: boolean;
  aiFilledFields?: string[];
};

function normalizeCorrections(raw: unknown): QuickPasteCorrectionInput[] {
  if (!Array.isArray(raw)) return [];
  const out: QuickPasteCorrectionInput[] = [];
  for (const row of raw) {
    if (!row || typeof row !== 'object') continue;
    const fieldKey = typeof (row as { fieldKey?: unknown }).fieldKey === 'string'
      ? (row as { fieldKey: string }).fieldKey
      : '';
    const correctValue = (row as { correctValue?: unknown }).correctValue;
    if (!fieldKey || correctValue == null || String(correctValue).trim() === '') continue;
    const wrongRaw = (row as { wrongValue?: unknown }).wrongValue;
    out.push({
      fieldKey,
      wrongValue: wrongRaw == null ? null : String(wrongRaw),
      correctValue: String(correctValue).trim(),
      snippet:
        typeof (row as { snippet?: unknown }).snippet === 'string'
          ? (row as { snippet: string }).snippet
          : null,
    });
  }
  return out;
}

export async function commitQuickPasteIntake(opts: {
  tenantId: string;
  userId: string;
  userRole: import('@prisma/client').UserRole;
  rawText: string;
  overrides: Record<string, unknown>;
  parseSnapshot?: QuickPasteCommitSnapshot;
  corrections?: QuickPasteCorrectionInput[];
}) {
  const rawText = opts.rawText.trim();
  if (!rawText) {
    throw new QuickPasteValidationError('붙여넣을 내용이 없습니다.');
  }

  const enriched = await parseQuickPasteForTenant(prisma, opts.tenantId, rawText, opts.userId);
  const ruleDraft = opts.parseSnapshot?.ruleDraft ?? enriched.ruleDraft;
  const previewDraft = opts.parseSnapshot?.previewDraft ?? enriched.draft;
  const aiApplied = opts.parseSnapshot?.aiApplied ?? enriched.aiApplied;
  const aiFilledFields = opts.parseSnapshot?.aiFilledFields ?? enriched.aiFilledFields;

  const draft = mergeQuickPasteDraft(enriched.draft, opts.overrides);
  const missing = validateQuickPasteDraft(draft);
  if (missing.length > 0) {
    throw new QuickPasteValidationError('필수 항목을 모두 입력해 주세요.', missing);
  }

  const userEditedFields = diffQuickPasteDraftFields(previewDraft, draft);

  const body: Record<string, unknown> = {
    customerName: draft.customerName,
    customerPhone: draft.customerPhone,
    address: draft.address,
    preferredDate: draft.preferredDate,
    preferredTime: draft.preferredTime,
    areaPyeong: draft.areaPyeong,
    serviceBalanceAmount: draft.serviceBalanceAmount,
    roomCount: draft.roomCount,
    bathroomCount: draft.bathroomCount,
    balconyCount: draft.balconyCount,
    specialNotes: rawText,
    status: 'RECEIVED',
    source: '카카오',
    intakeMeta: { channel: 'quick_paste' },
    isOneRoom: draft.isOneRoom,
  };

  let inquiry;
  try {
    inquiry = await createInquiryFromBody({
      tenantId: opts.tenantId,
      userId: opts.userId,
      userRole: opts.userRole,
      body,
      billingMode: 'quick_paste',
    });
  } catch (e) {
    if (e instanceof InquiryCreateError) {
      throw new QuickPasteValidationError(e.message);
    }
    throw e;
  }

  const soloAutoAssign = await tryQuickPasteSoloAutoAssign({
    db: prisma,
    tenantId: opts.tenantId,
    inquiryId: inquiry.id,
    assignedById: opts.userId,
  });

  let learnedRules: Array<{ fieldKey: string; pattern: string; created: boolean }> = [];
  try {
    await logQuickPasteLearning(prisma, {
      tenantId: opts.tenantId,
      userId: opts.userId,
      inquiryId: inquiry.id,
      rawText,
      ruleDraft,
      previewDraft,
      finalDraft: draft,
      missingAfterRule: enriched.missingAfterRule,
      aiApplied,
      aiFilledFields,
      userEditedFields,
    });
    learnedRules = await learnQuickPasteFromCommit(prisma, {
      tenantId: opts.tenantId,
      rawText,
      ruleDraft,
      previewDraft,
      finalDraft: draft,
      corrections: opts.corrections?.length ? opts.corrections : undefined,
    });
  } catch (e) {
    console.error('[quick-paste] learning log', e);
  }

  const duplicateMatches = draft.customerPhone
    ? (
        await findQuickPastePhoneDuplicates({
          db: prisma,
          tenantId: opts.tenantId,
          customerPhone: draft.customerPhone,
          limit: 6,
        })
      ).filter((row) => row.id !== inquiry.id)
    : [];

  return {
    inquiry,
    soloAutoAssign,
    duplicateMatches,
    aiApplied,
    userEditedFields,
    learnedRules,
    correctionsLearned: opts.corrections?.length ?? 0,
  };
}

export { normalizeCorrections };
