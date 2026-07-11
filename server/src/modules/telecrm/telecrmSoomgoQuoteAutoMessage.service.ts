import { prisma } from '../../lib/prisma.js';
import { parseSoomgoMessageSteps } from '../../lib/soomgoMessagePresets.js';
import { SOOMGO_QUOTE_AUTO_TRIGGER_KIND } from '../../lib/soomgoMessagePresets.js';

const QUOTE_LABEL = '견적보내기 자동 안내';

function parseStepsJson(stepsJson: string) {
  try {
    return parseSoomgoMessageSteps(JSON.parse(stepsJson)) ?? [];
  } catch {
    return [];
  }
}

function serializeQuoteRow(row: {
  id: string;
  label: string;
  stepsJson: string;
  isActive: boolean;
  paybackWon: number | null;
  operatingCompanyId: string | null;
}) {
  return {
    triggerKind: SOOMGO_QUOTE_AUTO_TRIGGER_KIND,
    id: row.id,
    label: row.label,
    steps: parseStepsJson(row.stepsJson),
    isActive: row.isActive,
    paybackWon: row.paybackWon,
    operatingCompanyId: row.operatingCompanyId,
  };
}

async function ensureQuotePresetRow(tenantId: string, operatingCompanyId: string | null) {
  const existing = await prisma.telecrmSoomgoMessagePreset.findFirst({
    where: {
      tenantId,
      triggerKind: SOOMGO_QUOTE_AUTO_TRIGGER_KIND,
      operatingCompanyId,
    },
  });
  if (existing) return existing;

  return prisma.telecrmSoomgoMessagePreset.create({
    data: {
      tenantId,
      ownerUserId: null,
      operatingCompanyId,
      slotNumber: 0,
      label: QUOTE_LABEL,
      stepsJson: '[]',
      sortOrder: 10,
      isActive: false,
      triggerKind: SOOMGO_QUOTE_AUTO_TRIGGER_KIND,
      paybackWon: 20000,
    },
  });
}

import {
  assertOperatingCompanyForTenant,
  parseTelecrmOperatingCompanyId,
} from './telecrmBrand.helpers.js';

export async function getTelecrmSoomgoQuoteAutoMessage(
  tenantId: string,
  operatingCompanyIdRaw: unknown,
) {
  const operatingCompanyId = parseTelecrmOperatingCompanyId(operatingCompanyIdRaw);
  if (operatingCompanyId) {
    await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);
  }

  const defaultRow = await ensureQuotePresetRow(tenantId, null);

  if (!operatingCompanyId) {
    return { item: serializeQuoteRow(defaultRow), fallbackFromDefault: false as const };
  }

  const brandRow = await prisma.telecrmSoomgoMessagePreset.findFirst({
    where: {
      tenantId,
      triggerKind: SOOMGO_QUOTE_AUTO_TRIGGER_KIND,
      operatingCompanyId,
    },
  });

  if (brandRow) {
    return { item: serializeQuoteRow(brandRow), fallbackFromDefault: false as const };
  }

  const draftRow = await ensureQuotePresetRow(tenantId, operatingCompanyId);
  return {
    item: serializeQuoteRow(draftRow),
    fallbackFromDefault: true as const,
    defaultItem: serializeQuoteRow(defaultRow),
  };
}

export async function resolveTelecrmSoomgoQuoteAutoMessageForSend(
  tenantId: string,
  operatingCompanyId: string | null,
) {
  if (operatingCompanyId) {
    await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);
    const brand = await prisma.telecrmSoomgoMessagePreset.findFirst({
      where: {
        tenantId,
        triggerKind: SOOMGO_QUOTE_AUTO_TRIGGER_KIND,
        operatingCompanyId,
        isActive: true,
      },
    });
    if (brand) return serializeQuoteRow(brand);
  }
  const fallback = await prisma.telecrmSoomgoMessagePreset.findFirst({
    where: {
      tenantId,
      triggerKind: SOOMGO_QUOTE_AUTO_TRIGGER_KIND,
      operatingCompanyId: null,
      isActive: true,
    },
  });
  return fallback ? serializeQuoteRow(fallback) : null;
}

export async function upsertTelecrmSoomgoQuoteAutoMessage(
  tenantId: string,
  operatingCompanyIdRaw: unknown,
  input: { steps: unknown; isActive: boolean; paybackWon?: unknown },
) {
  const operatingCompanyId = parseTelecrmOperatingCompanyId(operatingCompanyIdRaw);
  if (operatingCompanyId) {
    await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);
  }

  const parsedSteps = parseSoomgoMessageSteps(input.steps);
  if (input.isActive && (!parsedSteps || parsedSteps.length === 0)) {
    throw new Error('STEPS_REQUIRED');
  }

  let paybackWon: number | null = null;
  if (input.paybackWon != null && input.paybackWon !== '') {
    const n = Number(input.paybackWon);
    if (!Number.isFinite(n) || n < 0 || n > 100_000_000) {
      throw new Error('INVALID_PAYBACK');
    }
    paybackWon = Math.floor(n);
  }

  const row = await ensureQuotePresetRow(tenantId, operatingCompanyId);
  const data: {
    label: string;
    stepsJson: string;
    isActive: boolean;
    paybackWon?: number | null;
  } = {
    label: QUOTE_LABEL,
    stepsJson: JSON.stringify(parsedSteps ?? []),
    isActive: input.isActive,
  };
  if (input.paybackWon !== undefined) {
    data.paybackWon = paybackWon;
  }
  const updated = await prisma.telecrmSoomgoMessagePreset.update({
    where: { id: row.id },
    data,
  });
  return serializeQuoteRow(updated);
}
