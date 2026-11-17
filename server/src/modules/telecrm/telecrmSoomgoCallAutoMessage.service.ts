import { prisma } from '../../lib/prisma.js';
import { parseSoomgoMessageSteps } from '../../lib/soomgoMessagePresets.js';
import { SOOMGO_CALL_AUTO_TRIGGER_KIND } from '../../lib/soomgoMessagePresets.js';
import {
  assertOperatingCompanyForTenant,
  requireTelecrmOperatingCompanyId,
} from './telecrmBrand.helpers.js';
import { presetForSend } from './telecrmSoomgoPresetBrand.js';

const CALL_LABEL = '통화 시 자동 안내';
const DEFAULT_CALL_TEXT = '{마케터명}님이 지금 전화 연결을 시도 중입니다.';

function defaultCallStepsJson(): string {
  return JSON.stringify([{ type: 'text', text: DEFAULT_CALL_TEXT }]);
}

function parseStepsJson(stepsJson: string) {
  try {
    return parseSoomgoMessageSteps(JSON.parse(stepsJson)) ?? [];
  } catch {
    return [];
  }
}

function serializeCallRow(
  row: {
    id: string;
    label: string;
    stepsJson: string;
    isActive: boolean;
    operatingCompanyId: string | null;
    ownerUserId: string | null;
  },
  opts?: { fallbackFromDefault?: boolean },
) {
  if (!row.ownerUserId) {
    throw new Error('INVALID_CALL_AUTO_OWNER');
  }
  return {
    triggerKind: SOOMGO_CALL_AUTO_TRIGGER_KIND,
    id: row.id,
    label: row.label,
    steps: parseStepsJson(row.stepsJson),
    isActive: row.isActive,
    operatingCompanyId: row.operatingCompanyId,
    ownerUserId: row.ownerUserId,
    ...(opts?.fallbackFromDefault ? { fallbackFromDefault: true as const } : {}),
  };
}

async function ensureCallPresetRow(
  tenantId: string,
  ownerUserId: string,
  operatingCompanyId: string | null,
) {
  const existing = await prisma.telecrmSoomgoMessagePreset.findFirst({
    where: {
      tenantId,
      ownerUserId,
      triggerKind: SOOMGO_CALL_AUTO_TRIGGER_KIND,
      operatingCompanyId,
    },
  });
  if (existing) return existing;

  return prisma.telecrmSoomgoMessagePreset.create({
    data: {
      tenantId,
      ownerUserId,
      operatingCompanyId,
      slotNumber: 0,
      label: CALL_LABEL,
      stepsJson: defaultCallStepsJson(),
      sortOrder: 20,
      isActive: false,
      triggerKind: SOOMGO_CALL_AUTO_TRIGGER_KIND,
    },
  });
}

async function getCallPresetForBrand(
  tenantId: string,
  ownerUserId: string,
  operatingCompanyId: string,
) {
  const brandRow = await prisma.telecrmSoomgoMessagePreset.findFirst({
    where: {
      tenantId,
      ownerUserId,
      triggerKind: SOOMGO_CALL_AUTO_TRIGGER_KIND,
      operatingCompanyId,
    },
  });
  if (brandRow) {
    return { item: serializeCallRow(brandRow), fallbackFromDefault: false as const };
  }
  return {
    item: {
      triggerKind: SOOMGO_CALL_AUTO_TRIGGER_KIND,
      id: '',
      label: CALL_LABEL,
      steps: [],
      isActive: false,
      operatingCompanyId,
      ownerUserId,
    },
    fallbackFromDefault: false as const,
  };
}

export async function getTelecrmSoomgoCallAutoMessage(
  tenantId: string,
  ownerUserId: string,
  operatingCompanyIdRaw: unknown,
) {
  const operatingCompanyId = requireTelecrmOperatingCompanyId(operatingCompanyIdRaw);
  await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);

  const result = await getCallPresetForBrand(tenantId, ownerUserId, operatingCompanyId);
  return {
    item: result.item,
    fallbackFromDefault: false as const,
  };
}

/** 통화 버튼 — 이 직원·이 브랜드 행만. 다른 직원·업체 공통은 쓰지 않는다. */
export async function resolveTelecrmSoomgoCallAutoMessageForSend(
  tenantId: string,
  ownerUserId: string,
  operatingCompanyId: string | null,
) {
  if (!operatingCompanyId) return null;
  await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);
  const brand = await prisma.telecrmSoomgoMessagePreset.findFirst({
    where: {
      tenantId,
      ownerUserId,
      triggerKind: SOOMGO_CALL_AUTO_TRIGGER_KIND,
      operatingCompanyId,
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
      paybackWon: brand.paybackWon ?? null,
      label: brand.label,
    })
  ) {
    return null;
  }
  return serializeCallRow(brand);
}

export async function upsertTelecrmSoomgoCallAutoMessage(
  tenantId: string,
  ownerUserId: string,
  operatingCompanyIdRaw: unknown,
  input: { steps: unknown; isActive: boolean },
) {
  const operatingCompanyId = requireTelecrmOperatingCompanyId(operatingCompanyIdRaw);
  await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);

  const parsedSteps = parseSoomgoMessageSteps(input.steps);
  if (input.isActive && (!parsedSteps || parsedSteps.length === 0)) {
    throw new Error('STEPS_REQUIRED');
  }

  const row = await ensureCallPresetRow(tenantId, ownerUserId, operatingCompanyId);
  const updated = await prisma.telecrmSoomgoMessagePreset.update({
    where: { id: row.id },
    data: {
      label: CALL_LABEL,
      stepsJson: JSON.stringify(parsedSteps ?? []),
      isActive: input.isActive,
    },
  });
  return serializeCallRow(updated);
}
