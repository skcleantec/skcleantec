import type { SoomgoMessageStep } from '../../lib/soomgoMessagePresets.js';
import { parseSoomgoMessageSteps } from '../../lib/soomgoMessagePresets.js';
import { prisma } from '../../lib/prisma.js';
import {
  assertOperatingCompanyForTenant,
  requireTelecrmOperatingCompanyId,
} from './telecrmBrand.helpers.js';
import {
  getTelecrmSoomgoQuoteAutoMessage,
  upsertTelecrmSoomgoQuoteAutoMessage,
} from './telecrmSoomgoQuoteAutoMessage.service.js';
import {
  QUICK_QUOTE_AUTO_CHIP_LABEL,
  QUICK_QUOTE_TRIGGER_KIND,
} from './telecrmQuickQuote.constants.js';

export type QuickQuoteKindSource = 'auto_quote' | 'quick_quote';

export type QuickQuoteKindDto = {
  id: string;
  source: QuickQuoteKindSource;
  label: string;
  steps: SoomgoMessageStep[];
  paybackWon: number | null;
  isActive: boolean;
  sortOrder: number;
};

function parseStepsJson(stepsJson: string): SoomgoMessageStep[] {
  try {
    return parseSoomgoMessageSteps(JSON.parse(stepsJson)) ?? [];
  } catch {
    return [];
  }
}

function parsePayback(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
    throw new Error('INVALID_PAYBACK');
  }
  return Math.floor(n);
}

function parseLabel(raw: unknown): string {
  const label = typeof raw === 'string' ? raw.trim() : '';
  if (!label) throw new Error('LABEL_REQUIRED');
  if (label.length > 40) throw new Error('LABEL_TOO_LONG');
  if (label === QUICK_QUOTE_AUTO_CHIP_LABEL) throw new Error('LABEL_RESERVED');
  return label;
}

function requireSteps(raw: unknown): SoomgoMessageStep[] {
  const steps = parseSoomgoMessageSteps(raw);
  if (!steps?.length) throw new Error('STEPS_REQUIRED');
  return steps;
}

async function assertLabelFree(tenantId: string, operatingCompanyId: string, label: string, exceptId?: string) {
  const dup = await prisma.telecrmSoomgoMessagePreset.findFirst({
    where: {
      tenantId,
      operatingCompanyId,
      ownerUserId: null,
      triggerKind: QUICK_QUOTE_TRIGGER_KIND,
      label,
      ...(exceptId ? { id: { not: exceptId } } : {}),
    },
    select: { id: true },
  });
  if (dup) throw new Error('LABEL_TAKEN');
}

function serializeExtra(row: {
  id: string;
  label: string;
  stepsJson: string;
  paybackWon: number | null;
  isActive: boolean;
  sortOrder: number;
}): QuickQuoteKindDto {
  return {
    id: row.id,
    source: 'quick_quote',
    label: row.label,
    steps: parseStepsJson(row.stepsJson),
    paybackWon: row.paybackWon,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

export async function listQuickQuoteKinds(
  tenantId: string,
  operatingCompanyIdRaw: unknown,
): Promise<{ kinds: QuickQuoteKindDto[] }> {
  const operatingCompanyId = requireTelecrmOperatingCompanyId(operatingCompanyIdRaw);
  await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);
  const quote = await getTelecrmSoomgoQuoteAutoMessage(tenantId, operatingCompanyId);
  const extras = await prisma.telecrmSoomgoMessagePreset.findMany({
    where: {
      tenantId,
      operatingCompanyId,
      ownerUserId: null,
      triggerKind: QUICK_QUOTE_TRIGGER_KIND,
    },
    orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
  });
  const auto = quote.item;
  const kinds: QuickQuoteKindDto[] = [
    {
      id: auto.id || 'auto_quote',
      source: 'auto_quote',
      label: QUICK_QUOTE_AUTO_CHIP_LABEL,
      steps: auto.steps,
      paybackWon: auto.paybackWon,
      isActive: auto.isActive,
      sortOrder: -1,
    },
    ...extras.map(serializeExtra),
  ];
  return { kinds };
}

export async function saveQuickQuoteAutoKind(
  tenantId: string,
  operatingCompanyIdRaw: unknown,
  input: { steps: unknown; paybackWon?: unknown },
) {
  const operatingCompanyId = requireTelecrmOperatingCompanyId(operatingCompanyIdRaw);
  const current = await getTelecrmSoomgoQuoteAutoMessage(tenantId, operatingCompanyId);
  const steps = requireSteps(input.steps);
  const paybackWon =
    input.paybackWon === undefined ? (current.item.paybackWon ?? undefined) : parsePayback(input.paybackWon);
  await upsertTelecrmSoomgoQuoteAutoMessage(tenantId, operatingCompanyId, {
    steps,
    isActive: current.item.isActive,
    paybackWon,
  });
  return listQuickQuoteKinds(tenantId, operatingCompanyId);
}

export async function createQuickQuoteKind(
  tenantId: string,
  operatingCompanyIdRaw: unknown,
  input: { label: unknown; steps: unknown; paybackWon?: unknown },
) {
  const operatingCompanyId = requireTelecrmOperatingCompanyId(operatingCompanyIdRaw);
  await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);
  const label = parseLabel(input.label);
  const steps = requireSteps(input.steps);
  const paybackWon = input.paybackWon === undefined ? null : parsePayback(input.paybackWon);
  await assertLabelFree(tenantId, operatingCompanyId, label);
  const max = await prisma.telecrmSoomgoMessagePreset.aggregate({
    where: {
      tenantId,
      operatingCompanyId,
      ownerUserId: null,
      triggerKind: QUICK_QUOTE_TRIGGER_KIND,
    },
    _max: { sortOrder: true },
  });
  await prisma.telecrmSoomgoMessagePreset.create({
    data: {
      tenantId,
      ownerUserId: null,
      operatingCompanyId,
      slotNumber: 0,
      label,
      stepsJson: JSON.stringify(steps),
      sortOrder: (max._max.sortOrder ?? -1) + 1,
      isActive: true,
      triggerKind: QUICK_QUOTE_TRIGGER_KIND,
      paybackWon,
    },
  });
  return listQuickQuoteKinds(tenantId, operatingCompanyId);
}

async function findExtra(tenantId: string, operatingCompanyId: string, id: string) {
  return prisma.telecrmSoomgoMessagePreset.findFirst({
    where: {
      id,
      tenantId,
      operatingCompanyId,
      ownerUserId: null,
      triggerKind: QUICK_QUOTE_TRIGGER_KIND,
    },
  });
}

export async function updateQuickQuoteKind(
  tenantId: string,
  operatingCompanyIdRaw: unknown,
  id: string,
  input: { label?: unknown; steps?: unknown; paybackWon?: unknown },
) {
  const operatingCompanyId = requireTelecrmOperatingCompanyId(operatingCompanyIdRaw);
  await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);
  const existing = await findExtra(tenantId, operatingCompanyId, id);
  if (!existing) throw new Error('NOT_FOUND');
  const label = input.label === undefined ? existing.label : parseLabel(input.label);
  if (label !== existing.label) await assertLabelFree(tenantId, operatingCompanyId, label, existing.id);
  const steps = input.steps === undefined ? parseStepsJson(existing.stepsJson) : requireSteps(input.steps);
  if (!steps.length) throw new Error('STEPS_REQUIRED');
  const paybackWon = input.paybackWon === undefined ? existing.paybackWon : parsePayback(input.paybackWon);
  await prisma.telecrmSoomgoMessagePreset.update({
    where: { id: existing.id },
    data: {
      label,
      stepsJson: JSON.stringify(steps),
      paybackWon,
    },
  });
  return listQuickQuoteKinds(tenantId, operatingCompanyId);
}

export async function deleteQuickQuoteKind(tenantId: string, operatingCompanyIdRaw: unknown, id: string) {
  const operatingCompanyId = requireTelecrmOperatingCompanyId(operatingCompanyIdRaw);
  await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);
  const existing = await findExtra(tenantId, operatingCompanyId, id);
  if (!existing) throw new Error('NOT_FOUND');
  await prisma.telecrmSoomgoMessagePreset.deleteMany({
    where: {
      id: existing.id,
      tenantId,
      operatingCompanyId,
      triggerKind: QUICK_QUOTE_TRIGGER_KIND,
    },
  });
  return listQuickQuoteKinds(tenantId, operatingCompanyId);
}

export async function reorderQuickQuoteKinds(
  tenantId: string,
  operatingCompanyIdRaw: unknown,
  orderedIds: unknown,
) {
  const operatingCompanyId = requireTelecrmOperatingCompanyId(operatingCompanyIdRaw);
  await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);
  if (!Array.isArray(orderedIds) || orderedIds.some((id) => typeof id !== 'string' || !id)) {
    throw new Error('INVALID_ORDER');
  }
  const ids = orderedIds as string[];
  const rows = await prisma.telecrmSoomgoMessagePreset.findMany({
    where: {
      tenantId,
      operatingCompanyId,
      ownerUserId: null,
      triggerKind: QUICK_QUOTE_TRIGGER_KIND,
      id: { in: ids },
    },
    select: { id: true },
  });
  if (rows.length !== ids.length) throw new Error('INVALID_ORDER');
  await prisma.$transaction(
    ids.map((id, index) =>
      prisma.telecrmSoomgoMessagePreset.updateMany({
        where: {
          id,
          tenantId,
          operatingCompanyId,
          triggerKind: QUICK_QUOTE_TRIGGER_KIND,
        },
        data: { sortOrder: index },
      }),
    ),
  );
  return listQuickQuoteKinds(tenantId, operatingCompanyId);
}
