import { prisma } from '../../lib/prisma.js';
import { parseSoomgoMessageSteps } from '../../lib/soomgoMessagePresets.js';
import type { SoomgoIntakeAutoTriggerKind } from '../../lib/soomgoMessagePresets.js';
import { QUICK_QUOTE_TRIGGER_KIND } from './telecrmQuickQuote.constants.js';
import {
  isSoomgoIntakeAutoTriggerKind,
  SOOMGO_INTAKE_AUTO_TRIGGER_KINDS,
  SOOMGO_INTAKE_AUTO_TRIGGER_LABELS,
  SOOMGO_ALL_AUTO_TRIGGER_KINDS,
} from '../../lib/soomgoMessagePresets.js';
import {
  assertOperatingCompanyForTenant,
  requireTelecrmOperatingCompanyId,
} from './telecrmBrand.helpers.js';
import { presetForSend, presetStepCount } from './telecrmSoomgoPresetBrand.js';

const AUTO_LABELS: Record<SoomgoIntakeAutoTriggerKind, string> = {
  auto_requested: '요청 자동 안내',
  auto_absent: '부재 자동 안내',
  auto_hold: '보류·고민 자동 안내',
  auto_deposit: '예약금 대기 자동 안내',
  auto_reserved: '입금 완료 자동 안내',
  auto_received: '예약완료 자동 안내',
};

const AUTO_SORT: Record<SoomgoIntakeAutoTriggerKind, number> = {
  auto_requested: 0,
  auto_absent: 1,
  auto_hold: 2,
  auto_deposit: 3,
  auto_reserved: 4,
  auto_received: 5,
};

function parseStepsJson(stepsJson: string) {
  try {
    return parseSoomgoMessageSteps(JSON.parse(stepsJson)) ?? [];
  } catch {
    return [];
  }
}

function serializeAutoRow(
  row: {
    id: string;
    label: string;
    stepsJson: string;
    isActive: boolean;
    triggerKind: string | null;
    operatingCompanyId: string | null;
  },
  opts?: { fallbackFromDefault?: boolean },
) {
  const triggerKind = row.triggerKind;
  if (!isSoomgoIntakeAutoTriggerKind(triggerKind)) {
    throw new Error('INVALID_AUTO_TRIGGER');
  }
  return {
    triggerKind,
    id: row.id,
    label: row.label,
    steps: parseStepsJson(row.stepsJson),
    isActive: row.isActive,
    operatingCompanyId: row.operatingCompanyId,
    ...(opts?.fallbackFromDefault ? { fallbackFromDefault: true as const } : {}),
  };
}

async function ensureAutoPresetRow(
  tenantId: string,
  triggerKind: SoomgoIntakeAutoTriggerKind,
  operatingCompanyId: string | null,
) {
  const existing = await prisma.telecrmSoomgoMessagePreset.findFirst({
    where: { tenantId, triggerKind, operatingCompanyId, ownerUserId: null },
  });
  if (existing) return existing;

  return prisma.telecrmSoomgoMessagePreset.create({
    data: {
      tenantId,
      ownerUserId: null,
      operatingCompanyId,
      slotNumber: 0,
      label: AUTO_LABELS[triggerKind],
      stepsJson: '[]',
      sortOrder: AUTO_SORT[triggerKind],
      isActive: false,
      triggerKind,
    },
  });
}

async function getAutoPresetForBrand(
  tenantId: string,
  triggerKind: SoomgoIntakeAutoTriggerKind,
  operatingCompanyId: string,
) {
  const brandRow = await prisma.telecrmSoomgoMessagePreset.findFirst({
    where: { tenantId, triggerKind, operatingCompanyId, ownerUserId: null },
  });
  if (brandRow) {
    return { item: serializeAutoRow(brandRow) };
  }
  return {
    item: {
      triggerKind,
      id: '',
      label: AUTO_LABELS[triggerKind],
      steps: [],
      isActive: false,
      operatingCompanyId,
    },
  };
}

export async function listTelecrmSoomgoAutoMessages(
  tenantId: string,
  operatingCompanyIdRaw?: unknown,
) {
  const operatingCompanyId = requireTelecrmOperatingCompanyId(operatingCompanyIdRaw);
  await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);

  const results = await Promise.all(
    SOOMGO_INTAKE_AUTO_TRIGGER_KINDS.map((kind) =>
      getAutoPresetForBrand(tenantId, kind, operatingCompanyId),
    ),
  );

  results.sort(
    (a, b) =>
      AUTO_SORT[a.item.triggerKind] - AUTO_SORT[b.item.triggerKind],
  );

  return {
    items: results.map((r) => r.item),
    fallbackFromDefault: false,
    labels: SOOMGO_INTAKE_AUTO_TRIGGER_LABELS,
    operatingCompanyId,
  };
}

export async function resolveTelecrmSoomgoIntakeAutoMessageForSend(
  tenantId: string,
  operatingCompanyId: string | null,
  triggerKindRaw: string,
) {
  if (!isSoomgoIntakeAutoTriggerKind(triggerKindRaw)) {
    throw new Error('INVALID_TRIGGER');
  }
  const triggerKind = triggerKindRaw;

  if (!operatingCompanyId) return null;
  await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);
  const brand = await prisma.telecrmSoomgoMessagePreset.findFirst({
    where: {
      tenantId,
      triggerKind,
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
      paybackWon: null,
      label: brand.label,
    })
  ) {
    return null;
  }
  if (presetStepCount(brand.stepsJson) === 0) return null;
  return serializeAutoRow(brand);
}

export async function upsertTelecrmSoomgoAutoMessage(
  tenantId: string,
  triggerKindRaw: string,
  input: { steps: unknown; isActive: boolean; operatingCompanyId?: unknown },
) {
  if (!isSoomgoIntakeAutoTriggerKind(triggerKindRaw)) {
    throw new Error('INVALID_TRIGGER');
  }
  const triggerKind = triggerKindRaw;
  const operatingCompanyId = requireTelecrmOperatingCompanyId(input.operatingCompanyId);
  await assertOperatingCompanyForTenant(tenantId, operatingCompanyId);

  const parsedSteps = parseSoomgoMessageSteps(input.steps);
  if (input.isActive && (!parsedSteps || parsedSteps.length === 0)) {
    throw new Error('STEPS_REQUIRED');
  }

  const row = await ensureAutoPresetRow(tenantId, triggerKind, operatingCompanyId);
  const updated = await prisma.telecrmSoomgoMessagePreset.update({
    where: { id: row.id },
    data: {
      label: AUTO_LABELS[triggerKind],
      stepsJson: JSON.stringify(parsedSteps ?? []),
      isActive: input.isActive,
    },
  });
  return serializeAutoRow(updated);
}

/** 수동 매크로 목록 — 자동 트리거·견적 도우미 종류 제외 */
export function manualSoomgoPresetWhereExtra() {
  return {
    OR: [
      { triggerKind: null },
      { triggerKind: { notIn: [...SOOMGO_ALL_AUTO_TRIGGER_KINDS, QUICK_QUOTE_TRIGGER_KIND] } },
    ],
  };
}
