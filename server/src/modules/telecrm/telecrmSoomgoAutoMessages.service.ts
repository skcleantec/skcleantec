import { prisma } from '../../lib/prisma.js';
import { parseSoomgoMessageSteps } from '../../lib/soomgoMessagePresets.js';
import type { SoomgoAutoTriggerKind } from '../../lib/soomgoMessagePresets.js';
import {
  isSoomgoAutoTriggerKind,
  SOOMGO_AUTO_TRIGGER_KINDS,
  SOOMGO_AUTO_TRIGGER_LABELS,
} from '../../lib/soomgoMessagePresets.js';

const AUTO_LABELS: Record<SoomgoAutoTriggerKind, string> = {
  auto_requested: '요청 자동 안내',
  auto_absent: '부재 자동 안내',
  auto_hold: '보류·고민 자동 안내',
  auto_deposit: '예약금 대기 자동 안내',
  auto_reserved: '입금 완료 자동 안내',
  auto_received: '예약완료 자동 안내',
};

const AUTO_SORT: Record<SoomgoAutoTriggerKind, number> = {
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

function serializeAutoRow(row: {
  id: string;
  label: string;
  stepsJson: string;
  isActive: boolean;
  triggerKind: string | null;
}) {
  const triggerKind = row.triggerKind;
  if (!isSoomgoAutoTriggerKind(triggerKind)) {
    throw new Error('INVALID_AUTO_TRIGGER');
  }
  return {
    triggerKind,
    id: row.id,
    label: row.label,
    steps: parseStepsJson(row.stepsJson),
    isActive: row.isActive,
  };
}

async function ensureAutoPresetRow(tenantId: string, triggerKind: SoomgoAutoTriggerKind) {
  const existing = await prisma.telecrmSoomgoMessagePreset.findFirst({
    where: { tenantId, triggerKind },
  });
  if (existing) return existing;

  return prisma.telecrmSoomgoMessagePreset.create({
    data: {
      tenantId,
      ownerUserId: null,
      slotNumber: 0,
      label: AUTO_LABELS[triggerKind],
      stepsJson: '[]',
      sortOrder: AUTO_SORT[triggerKind],
      isActive: false,
      triggerKind,
    },
  });
}

export async function listTelecrmSoomgoAutoMessages(tenantId: string) {
  const rows = await Promise.all(
    SOOMGO_AUTO_TRIGGER_KINDS.map((kind) => ensureAutoPresetRow(tenantId, kind)),
  );
  rows.sort((a, b) => {
    const ak = a.triggerKind as SoomgoAutoTriggerKind;
    const bk = b.triggerKind as SoomgoAutoTriggerKind;
    return (AUTO_SORT[ak] ?? 0) - (AUTO_SORT[bk] ?? 0);
  });
  return {
    items: rows.map(serializeAutoRow),
    labels: SOOMGO_AUTO_TRIGGER_LABELS,
  };
}

export async function upsertTelecrmSoomgoAutoMessage(
  tenantId: string,
  triggerKindRaw: string,
  input: { steps: unknown; isActive: boolean },
) {
  if (!isSoomgoAutoTriggerKind(triggerKindRaw)) {
    throw new Error('INVALID_TRIGGER');
  }
  const triggerKind = triggerKindRaw;
  const parsedSteps = parseSoomgoMessageSteps(input.steps);
  if (input.isActive && (!parsedSteps || parsedSteps.length === 0)) {
    throw new Error('STEPS_REQUIRED');
  }

  const row = await ensureAutoPresetRow(tenantId, triggerKind);
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

/** 수동 매크로 목록 — 자동 트리거 프리셋 제외 */
export function manualSoomgoPresetWhereExtra() {
  return {
    OR: [{ triggerKind: null }, { triggerKind: { notIn: [...SOOMGO_AUTO_TRIGGER_KINDS] } }],
  };
}
