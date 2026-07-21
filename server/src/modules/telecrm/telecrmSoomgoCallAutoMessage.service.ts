import { prisma } from '../../lib/prisma.js';
import { parseSoomgoMessageSteps } from '../../lib/soomgoMessagePresets.js';
import { SOOMGO_CALL_AUTO_TRIGGER_KIND } from '../../lib/soomgoMessagePresets.js';
import {
  assertOperatingCompanyForTenant,
  parseTelecrmOperatingCompanyId,
} from './telecrmBrand.helpers.js';

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
  operatingCompanyId: string | null,
) {
  const defaultRow = await ensureCallPresetRow(tenantId, ownerUserId, null);

  if (!operatingCompanyId) {
    return {
      item: serializeCallRow(defaultRow),
      fallbackFromDefault: false as const,
    };
  }

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

  const draftRow = await ensureCallPresetRow(tenantId, ownerUserId, operatingCompanyId);
  return {
    item: serializeCallRow(draftRow, { fallbackFromDefault: true }),
    fallbackFromDefault: true as const,
    defaultItem: serializeCallRow(defaultRow),
  };
}

export async function getTelecrmSoomgoCallAutoMessage(
  tenantId: string,
  ownerUserId: string,
  operatingCompanyIdRaw: unknown,
) {
  const operatingCompanyId = parseTelecrmOperatingCompanyId(operatingCompanyIdRaw);
  if (operatingCompanyId) {
    await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);
  }

  const result = await getCallPresetForBrand(tenantId, ownerUserId, operatingCompanyId);
  return {
    item: result.item,
    fallbackFromDefault: result.fallbackFromDefault,
    defaultItem: 'defaultItem' in result ? result.defaultItem : undefined,
  };
}

/** 통화 버튼 — 브랜드별(명시 OFF면 폴백 없음) → 개인 기본 */
export async function resolveTelecrmSoomgoCallAutoMessageForSend(
  tenantId: string,
  ownerUserId: string,
  operatingCompanyId: string | null,
) {
  if (operatingCompanyId) {
    await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);
    const brand = await prisma.telecrmSoomgoMessagePreset.findFirst({
      where: {
        tenantId,
        ownerUserId,
        triggerKind: SOOMGO_CALL_AUTO_TRIGGER_KIND,
        operatingCompanyId,
      },
    });
    if (brand) {
      if (brand.isActive && parseStepsJson(brand.stepsJson).length > 0) {
        return serializeCallRow(brand);
      }
      return null;
    }
  }

  const fallback = await prisma.telecrmSoomgoMessagePreset.findFirst({
    where: {
      tenantId,
      ownerUserId,
      triggerKind: SOOMGO_CALL_AUTO_TRIGGER_KIND,
      operatingCompanyId: null,
      isActive: true,
    },
  });
  if (fallback && parseStepsJson(fallback.stepsJson).length > 0) {
    return serializeCallRow(fallback);
  }
  return null;
}

export async function upsertTelecrmSoomgoCallAutoMessage(
  tenantId: string,
  ownerUserId: string,
  operatingCompanyIdRaw: unknown,
  input: { steps: unknown; isActive: boolean },
) {
  const operatingCompanyId = parseTelecrmOperatingCompanyId(operatingCompanyIdRaw);
  if (operatingCompanyId) {
    await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);
  }

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
