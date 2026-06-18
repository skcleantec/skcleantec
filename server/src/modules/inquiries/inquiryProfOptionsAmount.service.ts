import type { Prisma, PrismaClient } from '@prisma/client';
import { prisma } from '../../lib/prisma.js';
import {
  parseProfessionalOptionSelectionsRaw,
  filterActiveProfessionalOptionSelections,
  type ProfessionalOptionSelectionInput,
} from '../orderform/specialtyOptions.js';
import {
  extraChargeAddLine,
  recordExtraChargeChangeLog,
} from '../inquiry-extra-charges/inquiryExtraCharges.service.js';

export const PROF_OPTION_EXTRA_CHARGE_PREFIX = '전문시공: ';

export type InquiryProfOptionsReviewRow = {
  profOptionsAmountReviewPending: boolean;
  professionalOptionIds: unknown;
  serviceTotalAmount: number | null;
  orderForm?: {
    totalAmount: number | null;
    submittedAt: Date | string | null;
  } | null;
  extraCharges?: Array<{ description: string }>;
  additionalReceipts?: Array<{ id: string }>;
};

/**
 * 목록·상세 표시용 — DB 플래그가 false여도
 * (고객 제출 + 전문 시공 선택 + 계약 총액이 발급 원금 그대로)이면 금액 확정 대기로 본다.
 */
export function resolveProfOptionsAmountReviewPendingForDisplay(
  row: InquiryProfOptionsReviewRow,
): boolean {
  if (row.profOptionsAmountReviewPending) return true;

  if (row.orderForm?.submittedAt == null) return false;

  const selections = parseProfessionalOptionSelectionsRaw(row.professionalOptionIds);
  if (selections.length === 0) return false;

  const formTotal = row.orderForm.totalAmount;
  if (formTotal == null) return false;

  const serviceTotal = row.serviceTotalAmount ?? formTotal;
  if (serviceTotal !== formTotal) return false;

  if (
    row.extraCharges?.some((c) =>
      String(c.description).trim().startsWith(PROF_OPTION_EXTRA_CHARGE_PREFIX),
    )
  ) {
    return false;
  }

  if ((row.additionalReceipts?.length ?? 0) > 0) return false;

  return true;
}

export function attachProfOptionsAmountReviewPendingDisplay<T extends InquiryProfOptionsReviewRow>(
  row: T,
): T {
  return {
    ...row,
    profOptionsAmountReviewPending: resolveProfOptionsAmountReviewPendingForDisplay(row),
  };
}

function resolveSelectionUnitAmount(
  sel: ProfessionalOptionSelectionInput,
  priceAmount: number | null,
): number {
  if (sel.unitAmount != null && sel.unitAmount >= 0) return sel.unitAmount;
  return priceAmount != null && priceAmount > 0 ? priceAmount : 0;
}

export type ProfOptionAmountLineDraft = {
  optionId: string;
  label: string;
  quantity: number;
  standardUnitAmount: number;
  standardAmount: number;
  description: string;
  requiresManualAmount: boolean;
};

export type ProfOptionAmountLinePreview = ProfOptionAmountLineDraft & {
  alreadyApplied: boolean;
  appliedAmount: number | null;
};

export async function buildProfOptionAmountLineDrafts(
  prisma: PrismaClient,
  tenantId: string,
  professionalOptionIds: unknown,
): Promise<ProfOptionAmountLineDraft[]> {
  const rawSelections = parseProfessionalOptionSelectionsRaw(professionalOptionIds);
  const selections = await filterActiveProfessionalOptionSelections(
    prisma,
    tenantId,
    rawSelections,
  );
  if (selections.length === 0) return [];

  const ids = selections.map((s) => s.id);
  const rows = await prisma.professionalSpecialtyOption.findMany({
    where: { tenantId, id: { in: ids } },
    select: { id: true, label: true, priceAmount: true, isActive: true },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));

  const drafts: ProfOptionAmountLineDraft[] = [];
  for (const sel of selections) {
    const row = byId.get(sel.id);
    if (!row) continue;
    const standardUnitAmount = resolveSelectionUnitAmount(sel, row.priceAmount);
    const standardAmount = standardUnitAmount > 0 ? standardUnitAmount * sel.quantity : 0;
    const qtyPart = sel.quantity > 1 ? ` × ${sel.quantity}` : '';
    drafts.push({
      optionId: sel.id,
      label: row.label,
      quantity: sel.quantity,
      standardUnitAmount,
      standardAmount,
      description: `${PROF_OPTION_EXTRA_CHARGE_PREFIX}${row.label}${qtyPart}`,
      requiresManualAmount: standardAmount <= 0,
    });
  }
  return drafts;
}

export async function previewProfOptionAmountLinesForInquiry(params: {
  tenantId: string;
  inquiryId: string;
}): Promise<{ lines: ProfOptionAmountLinePreview[] }> {
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: params.inquiryId, tenantId: params.tenantId },
    select: { professionalOptionIds: true },
  });
  if (!inquiry) throw new Error('NOT_FOUND');

  const drafts = await buildProfOptionAmountLineDrafts(
    prisma,
    params.tenantId,
    inquiry.professionalOptionIds,
  );
  const existing = await prisma.inquiryExtraCharge.findMany({
    where: { inquiryId: params.inquiryId },
    select: { description: true, amount: true },
  });
  const existingByDesc = new Map(
    existing.map((r) => [r.description.trim(), r.amount] as const),
  );

  return {
    lines: drafts.map((d) => {
      const appliedAmount = existingByDesc.get(d.description.trim()) ?? null;
      return {
        ...d,
        alreadyApplied: appliedAmount != null,
        appliedAmount,
      };
    }),
  };
}

export type ProfOptionExtraChargeLine = {
  optionId: string;
  description: string;
  amount: number;
};

export async function buildProfOptionExtraChargeLines(
  prisma: PrismaClient,
  tenantId: string,
  professionalOptionIds: unknown,
): Promise<{ priced: ProfOptionExtraChargeLine[]; unpricedLabels: string[] }> {
  const drafts = await buildProfOptionAmountLineDrafts(prisma, tenantId, professionalOptionIds);
  const priced: ProfOptionExtraChargeLine[] = [];
  const unpricedLabels: string[] = [];
  for (const d of drafts) {
    if (d.standardAmount > 0) {
      priced.push({ optionId: d.optionId, description: d.description, amount: d.standardAmount });
    } else {
      unpricedLabels.push(d.quantity > 1 ? `${d.label} × ${d.quantity}` : d.label);
    }
  }
  return { priced, unpricedLabels };
}

export async function clearProfOptionsAmountReviewPending(
  tenantId: string,
  inquiryId: string,
): Promise<void> {
  await prisma.inquiry.updateMany({
    where: { id: inquiryId, tenantId, profOptionsAmountReviewPending: true },
    data: { profOptionsAmountReviewPending: false },
  });
}

export function shouldClearProfOptionsAmountReviewOnPatch(
  inquiry: {
    profOptionsAmountReviewPending: boolean;
    serviceTotalAmount: number | null;
    serviceDepositAmount: number | null;
    serviceBalanceAmount: number | null;
  },
  data: Prisma.InquiryUpdateInput,
): boolean {
  if (!inquiry.profOptionsAmountReviewPending) return false;
  const num = (v: unknown): number | null | undefined => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : undefined;
  };
  const nextTotal = num(data.serviceTotalAmount);
  const nextDeposit = num(data.serviceDepositAmount);
  const nextBalance = num(data.serviceBalanceAmount);
  if (nextTotal !== undefined && nextTotal !== inquiry.serviceTotalAmount) return true;
  if (nextDeposit !== undefined && nextDeposit !== inquiry.serviceDepositAmount) return true;
  if (nextBalance !== undefined && nextBalance !== inquiry.serviceBalanceAmount) return true;
  return false;
}

export async function applyProfOptionAmountsToInquiry(params: {
  tenantId: string;
  inquiryId: string;
  actorId: string;
  /** optionId별 청구 금액(원). 미입력 시 카탈로그 표준가 */
  lineAmounts?: Array<{ optionId: string; amount: number }>;
}): Promise<{
  createdCount: number;
  skippedCount: number;
  unpricedLabels: string[];
  profOptionsAmountReviewPending: boolean;
}> {
  const inquiry = await prisma.inquiry.findFirst({
    where: { id: params.inquiryId, tenantId: params.tenantId },
    select: {
      id: true,
      professionalOptionIds: true,
      profOptionsAmountReviewPending: true,
    },
  });
  if (!inquiry) {
    throw new Error('NOT_FOUND');
  }

  const drafts = await buildProfOptionAmountLineDrafts(
    prisma,
    params.tenantId,
    inquiry.professionalOptionIds,
  );
  const amountByOptionId = new Map<string, number>();
  if (params.lineAmounts?.length) {
    const allowedIds = new Set(drafts.map((d) => d.optionId));
    for (const row of params.lineAmounts) {
      const optionId = String(row.optionId ?? '').trim();
      if (!optionId || !allowedIds.has(optionId)) {
        throw new Error('INVALID_LINE');
      }
      const amount = Math.trunc(Number(row.amount));
      if (!Number.isFinite(amount) || amount < 0) {
        throw new Error('INVALID_AMOUNT');
      }
      amountByOptionId.set(optionId, amount);
    }
  }

  const unpricedLabels: string[] = [];
  const linesToCreate: ProfOptionExtraChargeLine[] = [];
  for (const draft of drafts) {
    const amount = amountByOptionId.has(draft.optionId)
      ? amountByOptionId.get(draft.optionId)!
      : draft.standardAmount;
    if (amount <= 0) {
      if (draft.requiresManualAmount) {
        unpricedLabels.push(draft.quantity > 1 ? `${draft.label} × ${draft.quantity}` : draft.label);
      }
      continue;
    }
    linesToCreate.push({
      optionId: draft.optionId,
      description: draft.description,
      amount,
    });
  }

  const existing = await prisma.inquiryExtraCharge.findMany({
    where: { inquiryId: params.inquiryId },
    select: { description: true },
  });
  const existingDesc = new Set(existing.map((r) => r.description.trim()));

  let createdCount = 0;
  let skippedCount = 0;
  let sortOrder =
    ((
      await prisma.inquiryExtraCharge.findFirst({
        where: { inquiryId: params.inquiryId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      })
    )?.sortOrder ?? -1) + 1;

  for (const line of linesToCreate) {
    if (existingDesc.has(line.description)) {
      skippedCount += 1;
      continue;
    }
    await prisma.inquiryExtraCharge.create({
      data: {
        inquiryId: params.inquiryId,
        description: line.description,
        amount: line.amount,
        sortOrder: sortOrder++,
        createdById: params.actorId,
      },
    });
    existingDesc.add(line.description);
    createdCount += 1;
    void recordExtraChargeChangeLog({
      inquiryId: params.inquiryId,
      actorId: params.actorId,
      line: extraChargeAddLine(line.description, line.amount),
    }).catch((e) => console.error('[prof-options-amount] changeLog', e));
  }

  const shouldClear = unpricedLabels.length === 0;
  if (shouldClear) {
    await clearProfOptionsAmountReviewPending(params.tenantId, params.inquiryId);
  }

  const row = await prisma.inquiry.findUnique({
    where: { id: params.inquiryId },
    select: { profOptionsAmountReviewPending: true },
  });

  return {
    createdCount,
    skippedCount,
    unpricedLabels,
    profOptionsAmountReviewPending: row?.profOptionsAmountReviewPending ?? false,
  };
}
