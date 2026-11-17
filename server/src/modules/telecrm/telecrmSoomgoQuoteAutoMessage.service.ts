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
      ownerUserId: null,
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
  requireTelecrmOperatingCompanyId,
} from './telecrmBrand.helpers.js';
import { presetForSend } from './telecrmSoomgoPresetBrand.js';

export async function getTelecrmSoomgoQuoteAutoMessage(
  tenantId: string,
  operatingCompanyIdRaw: unknown,
) {
  const operatingCompanyId = requireTelecrmOperatingCompanyId(operatingCompanyIdRaw);
  await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);

  const brandRow = await prisma.telecrmSoomgoMessagePreset.findFirst({
    where: {
      tenantId,
      triggerKind: SOOMGO_QUOTE_AUTO_TRIGGER_KIND,
      operatingCompanyId,
      ownerUserId: null,
    },
  });

  if (brandRow) {
    return { item: serializeQuoteRow(brandRow), fallbackFromDefault: false as const };
  }

  return {
    item: {
      triggerKind: SOOMGO_QUOTE_AUTO_TRIGGER_KIND,
      id: '',
      label: QUOTE_LABEL,
      steps: [],
      isActive: false,
      paybackWon: 20000,
      operatingCompanyId,
    },
    fallbackFromDefault: false as const,
  };
}

export async function resolveTelecrmSoomgoQuoteAutoMessageForSend(
  tenantId: string,
  operatingCompanyId: string | null,
) {
  if (!operatingCompanyId) return null;
  await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);
  const brand = await prisma.telecrmSoomgoMessagePreset.findFirst({
    where: {
      tenantId,
      triggerKind: SOOMGO_QUOTE_AUTO_TRIGGER_KIND,
      operatingCompanyId,
      ownerUserId: null,
    },
  });
  if (!brand?.triggerKind || !brand.operatingCompanyId) return null;
  if (
    !presetForSend({
      id: brand.id,
      tenantId: brand.tenantId,
      ownerUserId: brand.ownerUserId,
      operatingCompanyId: brand.operatingCompanyId,
      triggerKind: brand.triggerKind,
      stepsJson: brand.stepsJson,
      isActive: brand.isActive,
      paybackWon: brand.paybackWon,
      label: brand.label,
    })
  ) {
    return null;
  }
  return serializeQuoteRow(brand);
}

export async function upsertTelecrmSoomgoQuoteAutoMessage(
  tenantId: string,
  operatingCompanyIdRaw: unknown,
  input: { steps: unknown; isActive: boolean; paybackWon?: unknown },
) {
  const operatingCompanyId = requireTelecrmOperatingCompanyId(operatingCompanyIdRaw);
  await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);

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
