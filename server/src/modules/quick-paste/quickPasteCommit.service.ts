import { prisma } from '../../lib/prisma.js';
import { createInquiryFromBody, InquiryCreateError } from '../inquiries/inquiryCreate.service.js';
import { getTenantCoinSnapshot } from '../tenants/tenantCoin.service.js';
import { getTenantPlan } from '../tenants/tenantFeatures.service.js';
import { parseQuickPasteText, mergeQuickPasteDraft, validateQuickPasteDraft } from './quickPasteParse.service.js';
import { QUICK_PASTE_COIN_COST } from './quickPaste.constants.js';

export class QuickPasteValidationError extends Error {
  constructor(
    message: string,
    readonly missingFields?: string[],
  ) {
    super(message);
    this.name = 'QuickPasteValidationError';
  }
}

export async function buildQuickPastePreview(rawText: string, tenantId: string) {
  const parsed = parseQuickPasteText(rawText);
  const plan = await getTenantPlan(tenantId);
  const coins = await getTenantCoinSnapshot(prisma, tenantId, plan);

  return {
    ...parsed,
    specialNotes: rawText.trim(),
    coinCost: QUICK_PASTE_COIN_COST,
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
    specialNotes: rawText,
    status: 'RECEIVED',
    source: '카카오',
    intakeMeta: { channel: 'quick_paste' },
    isOneRoom: draft.isOneRoom,
  };

  try {
    return await createInquiryFromBody({
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
}
