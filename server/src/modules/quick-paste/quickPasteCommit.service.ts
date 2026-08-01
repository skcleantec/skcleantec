import { prisma } from '../../lib/prisma.js';
import { createInquiryFromBody, InquiryCreateError } from '../inquiries/inquiryCreate.service.js';
import { getTenantCoinSnapshot } from '../tenants/tenantCoin.service.js';
import { getTenantPlan } from '../tenants/tenantFeatures.service.js';
import { parseQuickPasteText, mergeQuickPasteDraft, validateQuickPasteDraft } from './quickPasteParse.service.js';
import { QUICK_PASTE_COIN_COST } from './quickPaste.constants.js';
import { findQuickPastePhoneDuplicates } from './quickPasteDuplicate.service.js';
import { previewQuickPasteSoloAutoAssign, tryQuickPasteSoloAutoAssign } from './quickPasteAutoAssign.service.js';

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
  const parsed = parseQuickPasteText(rawText);
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

export async function commitQuickPasteIntake(opts: {
  tenantId: string;
  userId: string;
  userRole: import('@prisma/client').UserRole;
  rawText: string;
  overrides: Record<string, unknown>;
}) {
  const rawText = opts.rawText.trim();
  if (!rawText) {
    throw new QuickPasteValidationError('붙여넣을 내용이 없습니다.');
  }

  const parsed = parseQuickPasteText(rawText);
  const draft = mergeQuickPasteDraft(parsed.draft, opts.overrides);
  const missing = validateQuickPasteDraft(draft);
  if (missing.length > 0) {
    throw new QuickPasteValidationError('필수 항목을 모두 입력해 주세요.', missing);
  }

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

  return { inquiry, soloAutoAssign, duplicateMatches };
}
