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
  additionalReceipts?: Array<{ id: string; description?: string }>;
};

async function loadProfOptionAppliedAmountByDescription(
  inquiryId: string,
): Promise<Map<string, number>> {
  const [extras, arcs] = await Promise.all([
    prisma.inquiryExtraCharge.findMany({
      where: { inquiryId, description: { startsWith: PROF_OPTION_EXTRA_CHARGE_PREFIX } },
      select: { description: true, amount: true },
    }),
    prisma.inquiryAdditionalReceipt.findMany({
      where: { inquiryId, description: { startsWith: PROF_OPTION_EXTRA_CHARGE_PREFIX } },
      select: { description: true, amount: true },
    }),
  ]);
  const byDesc = new Map<string, number>();
  for (const row of [...extras, ...arcs]) {
    byDesc.set(row.description.trim(), row.amount);
  }
  return byDesc;
}

function inquiryHasProfOptionAmountApplied(row: InquiryProfOptionsReviewRow): boolean {
  if (
    row.extraCharges?.some((c) =>
      String(c.description).trim().startsWith(PROF_OPTION_EXTRA_CHARGE_PREFIX),
    )
  ) {
    return true;
  }
  return Boolean(
    row.additionalReceipts?.some((c) =>
      String(c.description ?? '').trim().startsWith(PROF_OPTION_EXTRA_CHARGE_PREFIX),
    ),
  );
}

/**
 * 목록·상세 표시용 — DB 플래그가 false여도
 * (고객 제출 + 전문 시공 선택 + 계약 총액이 발급 원금 그대로)이면 금액 확정 대기로 본다.
 */
export function resolveProfOptionsAmountReviewPendingForDisplay(
  row: InquiryProfOptionsReviewRow,
): boolean {
  if (row.orderForm?.submittedAt == null) return false;

  const selections = parseProfessionalOptionSelectionsRaw(row.professionalOptionIds);
  if (selections.length === 0) return false;

  /** 반영된 전문시공 항목(extraCharge·추가결재)이 있으면 DB 플래그와 무관하게 완료 */
  if (inquiryHasProfOptionAmountApplied(row)) return false;

  const formTotal = row.orderForm.totalAmount;
  if (formTotal == null) return false;

  const serviceTotal = row.serviceTotalAmount ?? formTotal;
  if (serviceTotal !== formTotal) return false;

  return row.profOptionsAmountReviewPending || true;
}

export function attachProfOptionsReviewStatusDisplay<T extends InquiryProfOptionsReviewRow>(
  row: T,
): T & { profOptionsAmountReviewPending: boolean; profOptionsAmountReviewCompleted: boolean } {
  const pending = resolveProfOptionsAmountReviewPendingForDisplay(row);
  const hasSelections =
    parseProfessionalOptionSelectionsRaw(row.professionalOptionIds).length > 0;
  const completed = Boolean(
    hasSelections && row.orderForm?.submittedAt != null && !pending,
  );
  return {
    ...row,
    profOptionsAmountReviewPending: pending,
    profOptionsAmountReviewCompleted: completed,
  };
}

/** @deprecated 목록은 enrichInquiriesProfOptionsReviewStatus 사용 */
export function attachProfOptionsAmountReviewPendingDisplay<T extends InquiryProfOptionsReviewRow>(
  row: T,
): T {
  return attachProfOptionsReviewStatusDisplay(row);
}

/** 목록 API — extraCharges 미포함 시 DB 조회로 반영 여부 보정 */
export async function enrichInquiriesProfOptionsReviewStatus<
  T extends InquiryProfOptionsReviewRow & { id: string },
>(prisma: PrismaClient, rows: T[]): Promise<
  Array<T & { profOptionsAmountReviewPending: boolean; profOptionsAmountReviewCompleted: boolean }>
> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.id);
  const [profExtraRows, profArcRows] = await Promise.all([
    prisma.inquiryExtraCharge.findMany({
      where: {
        inquiryId: { in: ids },
        description: { startsWith: PROF_OPTION_EXTRA_CHARGE_PREFIX },
      },
      select: { inquiryId: true },
    }),
    prisma.inquiryAdditionalReceipt.findMany({
      where: {
        inquiryId: { in: ids },
        description: { startsWith: PROF_OPTION_EXTRA_CHARGE_PREFIX },
      },
      select: { inquiryId: true },
    }),
  ]);
  const inquiryIdsWithProfApplied = new Set([
    ...profExtraRows.map((r) => r.inquiryId),
    ...profArcRows.map((r) => r.inquiryId),
  ]);

  return rows.map((row) => {
    const rowForResolve: InquiryProfOptionsReviewRow = inquiryIdsWithProfApplied.has(row.id)
      ? {
          ...row,
          extraCharges: [{ description: PROF_OPTION_EXTRA_CHARGE_PREFIX }],
          additionalReceipts: [{ id: 'prof-applied', description: PROF_OPTION_EXTRA_CHARGE_PREFIX }],
        }
      : row;
    return attachProfOptionsReviewStatusDisplay(rowForResolve) as T & {
      profOptionsAmountReviewPending: boolean;
      profOptionsAmountReviewCompleted: boolean;
    };
  });
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
  const existingByDesc = await loadProfOptionAppliedAmountByDescription(params.inquiryId);

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

export async function markProfOptionsAmountReviewComplete(
  tenantId: string,
  inquiryId: string,
): Promise<void> {
  await prisma.inquiry.updateMany({
    where: { id: inquiryId, tenantId },
    data: { profOptionsAmountReviewPending: false },
  });
}

/** @deprecated markProfOptionsAmountReviewComplete 사용 */
export async function clearProfOptionsAmountReviewPending(
  tenantId: string,
  inquiryId: string,
): Promise<void> {
  await markProfOptionsAmountReviewComplete(tenantId, inquiryId);
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
  profOptionsAmountReviewCompleted: boolean;
  createdAdditionalReceipts: Array<{
    id: string;
    inquiryId: string;
    description: string;
    amount: number;
    settlementChannel: string;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
    createdBy: { id: string; name: string } | null;
  }>;
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
  type LineToApply = ProfOptionExtraChargeLine & { zeroConfirmOnly?: boolean };
  const linesToApply: LineToApply[] = [];
  for (const draft of drafts) {
    const explicit = amountByOptionId.has(draft.optionId);
    const amount = explicit ? amountByOptionId.get(draft.optionId)! : draft.standardAmount;
    if (amount < 0) {
      throw new Error('INVALID_AMOUNT');
    }
    if (amount === 0) {
      if (explicit) {
        linesToApply.push({
          optionId: draft.optionId,
          description: draft.description,
          amount: 0,
          zeroConfirmOnly: true,
        });
      } else if (draft.requiresManualAmount) {
        unpricedLabels.push(draft.quantity > 1 ? `${draft.label} × ${draft.quantity}` : draft.label);
      }
      continue;
    }
    linesToApply.push({
      optionId: draft.optionId,
      description: draft.description,
      amount,
    });
  }

  const existingDesc = new Set(
    [...(await loadProfOptionAppliedAmountByDescription(params.inquiryId)).keys()],
  );
  const confirmedZeroOptionIds = new Set<string>();

  let createdCount = 0;
  let skippedCount = 0;
  const createdAdditionalReceipts: Array<{
    id: string;
    inquiryId: string;
    description: string;
    amount: number;
    settlementChannel: string;
    sortOrder: number;
    createdAt: string;
    updatedAt: string;
    createdBy: { id: string; name: string } | null;
  }> = [];
  let sortOrder =
    ((
      await prisma.inquiryAdditionalReceipt.findFirst({
        where: { inquiryId: params.inquiryId },
        orderBy: { sortOrder: 'desc' },
        select: { sortOrder: true },
      })
    )?.sortOrder ?? -1) + 1;

  for (const line of linesToApply) {
    const descKey = line.description.trim();
    if (existingDesc.has(descKey)) {
      skippedCount += 1;
      continue;
    }
    if (line.zeroConfirmOnly) {
      confirmedZeroOptionIds.add(line.optionId);
      existingDesc.add(descKey);
      continue;
    }
    const created = await prisma.inquiryAdditionalReceipt.create({
      data: {
        inquiryId: params.inquiryId,
        description: line.description,
        amount: line.amount,
        settlementChannel: 'COMPANY_DEPOSIT',
        sortOrder: sortOrder++,
        createdById: params.actorId,
      },
      include: { createdBy: { select: { id: true, name: true } } },
    });
    existingDesc.add(descKey);
    createdCount += 1;
    createdAdditionalReceipts.push({
      id: created.id,
      inquiryId: created.inquiryId,
      description: created.description,
      amount: created.amount,
      settlementChannel: created.settlementChannel,
      sortOrder: created.sortOrder,
      createdAt: created.createdAt.toISOString(),
      updatedAt: created.updatedAt.toISOString(),
      createdBy: created.createdBy,
    });
    void recordExtraChargeChangeLog({
      inquiryId: params.inquiryId,
      actorId: params.actorId,
      line: extraChargeAddLine(line.description, line.amount),
    }).catch((e) => console.error('[prof-options-amount] changeLog', e));
  }

  const allDraftLinesSettled =
    drafts.length === 0 ||
    drafts.every(
      (d) => existingDesc.has(d.description.trim()) || confirmedZeroOptionIds.has(d.optionId),
    );
  if (unpricedLabels.length === 0 && allDraftLinesSettled) {
    await markProfOptionsAmountReviewComplete(params.tenantId, params.inquiryId);
  }

  const inquiryRow = await prisma.inquiry.findFirst({
    where: { id: params.inquiryId, tenantId: params.tenantId },
    select: {
      profOptionsAmountReviewPending: true,
      professionalOptionIds: true,
      serviceTotalAmount: true,
      orderForm: { select: { submittedAt: true, totalAmount: true } },
    },
  });
  const [extraCharges, additionalReceipts] = inquiryRow
    ? await Promise.all([
        prisma.inquiryExtraCharge.findMany({
          where: { inquiryId: params.inquiryId },
          select: { description: true },
        }),
        prisma.inquiryAdditionalReceipt.findMany({
          where: { inquiryId: params.inquiryId },
          select: { id: true, description: true },
        }),
      ])
    : [[], []];
  const status = inquiryRow
    ? attachProfOptionsReviewStatusDisplay({
        ...inquiryRow,
        profOptionsAmountReviewPending: inquiryRow.profOptionsAmountReviewPending,
        extraCharges,
        additionalReceipts,
      })
    : null;

  return {
    createdCount,
    skippedCount,
    unpricedLabels,
    profOptionsAmountReviewPending: status?.profOptionsAmountReviewPending ?? false,
    profOptionsAmountReviewCompleted: status?.profOptionsAmountReviewCompleted ?? false,
    createdAdditionalReceipts,
  };
}
