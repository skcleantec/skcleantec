/**
 * 영업 브랜드별 취소·변경 위약금 — server mirror (shared/operatingCompanyCancellationPolicy.ts 와 동기화)
 */

import { randomUUID } from 'crypto';

export type CancellationPenaltyKind =
  | 'percent'
  | 'no_cancel'
  | 'deposit_forfeit'
  | 'custom';

export type CancellationPolicyTier = {
  id: string;
  sortOrder: number;
  daysBefore: number;
  kind: CancellationPenaltyKind;
  percent?: number;
  customText?: string;
  note?: string;
};

export type OperatingCompanyCancellationPolicy = {
  enabled: boolean;
  freeChangeDaysBefore?: number | null;
  tiers: CancellationPolicyTier[];
  fallbackLine?: string;
};

export const CANCELLATION_POLICY_TIER_ID_PREFIX = 'cpt_';

export function createCancellationPolicyTierId(): string {
  return `${CANCELLATION_POLICY_TIER_ID_PREFIX}${randomUUID().slice(0, 8)}`;
}

const DEFAULT_TIER_IDS = {
  dayBefore: 'cpt_default_day_before',
  sameDay: 'cpt_default_same_day',
} as const;

export const DEFAULT_OPERATING_COMPANY_CANCELLATION_POLICY: OperatingCompanyCancellationPolicy = {
  enabled: true,
  freeChangeDaysBefore: 2,
  tiers: [
    {
      id: DEFAULT_TIER_IDS.dayBefore,
      sortOrder: 0,
      daysBefore: 1,
      kind: 'percent',
      percent: 30,
    },
    {
      id: DEFAULT_TIER_IDS.sameDay,
      sortOrder: 1,
      daysBefore: 0,
      kind: 'percent',
      percent: 50,
    },
  ],
};

export function resolveOperatingCompanyCancellationPolicy(
  raw: unknown,
): OperatingCompanyCancellationPolicy {
  const parsed = parseOperatingCompanyCancellationPolicy(raw);
  if (parsed) return parsed;
  return {
    ...DEFAULT_OPERATING_COMPANY_CANCELLATION_POLICY,
    tiers: DEFAULT_OPERATING_COMPANY_CANCELLATION_POLICY.tiers.map((t) => ({ ...t })),
  };
}

function parseTier(raw: unknown, index: number): CancellationPolicyTier | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const kindRaw = o.kind;
  const kind: CancellationPenaltyKind =
    kindRaw === 'percent' ||
    kindRaw === 'no_cancel' ||
    kindRaw === 'deposit_forfeit' ||
    kindRaw === 'custom'
      ? kindRaw
      : 'percent';
  const daysBeforeRaw = o.daysBefore;
  const daysBefore =
    typeof daysBeforeRaw === 'number' && Number.isFinite(daysBeforeRaw) && daysBeforeRaw >= 0
      ? Math.floor(daysBeforeRaw)
      : 0;
  const id =
    typeof o.id === 'string' && o.id.trim()
      ? o.id.trim().slice(0, 64)
      : createCancellationPolicyTierId();
  const sortOrderRaw = o.sortOrder;
  const sortOrder =
    typeof sortOrderRaw === 'number' && Number.isFinite(sortOrderRaw)
      ? Math.floor(sortOrderRaw)
      : index;
  const tier: CancellationPolicyTier = { id, sortOrder, daysBefore, kind };
  if (typeof o.percent === 'number' && Number.isFinite(o.percent)) {
    tier.percent = Math.min(100, Math.max(0, Math.round(o.percent)));
  }
  if (typeof o.customText === 'string' && o.customText.trim()) {
    tier.customText = o.customText.trim().slice(0, 500);
  }
  if (typeof o.note === 'string' && o.note.trim()) {
    tier.note = o.note.trim().slice(0, 200);
  }
  return tier;
}

export function parseOperatingCompanyCancellationPolicy(
  raw: unknown,
): OperatingCompanyCancellationPolicy | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== 'object' || Array.isArray(raw)) return undefined;
  const o = raw as Record<string, unknown>;
  const enabled = o.enabled !== false;
  const tiersRaw = o.tiers;
  const tiers: CancellationPolicyTier[] = [];
  if (Array.isArray(tiersRaw)) {
    tiersRaw.forEach((row, i) => {
      const t = parseTier(row, i);
      if (t) tiers.push(t);
    });
  }
  tiers.sort((a, b) => a.sortOrder - b.sortOrder || b.daysBefore - a.daysBefore);
  tiers.forEach((t, i) => {
    t.sortOrder = i;
  });
  const out: OperatingCompanyCancellationPolicy = { enabled, tiers };
  if (o.freeChangeDaysBefore === null) {
    out.freeChangeDaysBefore = null;
  } else if (typeof o.freeChangeDaysBefore === 'number' && Number.isFinite(o.freeChangeDaysBefore)) {
    out.freeChangeDaysBefore = Math.max(0, Math.floor(o.freeChangeDaysBefore));
  }
  if (typeof o.fallbackLine === 'string' && o.fallbackLine.trim()) {
    out.fallbackLine = o.fallbackLine.trim().slice(0, 500);
  }
  return out;
}

export function validateOperatingCompanyCancellationPolicy(
  policy: OperatingCompanyCancellationPolicy,
): { ok: true } | { ok: false; error: string } {
  if (!policy.enabled) return { ok: true };
  if (!policy.tiers.length) {
    return { ok: false, error: '위약금 구간을 1개 이상 추가해 주세요.' };
  }
  const seenDays = new Set<number>();
  for (const tier of policy.tiers) {
    if (seenDays.has(tier.daysBefore)) {
      return { ok: false, error: '같은 「며칠 전」 구간이 중복되었습니다.' };
    }
    seenDays.add(tier.daysBefore);
    if (tier.kind === 'percent') {
      if (tier.percent == null || tier.percent < 0 || tier.percent > 100) {
        return { ok: false, error: '위약금 비율은 0~100% 사이로 입력해 주세요.' };
      }
    }
    if (tier.kind === 'custom' && !tier.customText?.trim()) {
      return { ok: false, error: '직접 입력 구간에 문구를 입력해 주세요.' };
    }
  }
  if (
    policy.freeChangeDaysBefore != null &&
    (policy.freeChangeDaysBefore < 0 || policy.freeChangeDaysBefore > 365)
  ) {
    return { ok: false, error: '위약 없이 변경 가능 일수가 올바르지 않습니다.' };
  }
  return { ok: true };
}

function renderTierLine(tier: CancellationPolicyTier): string {
  const when =
    tier.daysBefore <= 0 ? '당일' : tier.daysBefore === 1 ? '전일' : `${tier.daysBefore}일 전`;
  let line = '';
  switch (tier.kind) {
    case 'percent':
      line = `고객님 사정으로 ${when} 청소 예약 취소 또는 변경 시 청소비 위약금 ${tier.percent ?? 0}%가 적용됩니다.`;
      break;
    case 'no_cancel':
      line = `${when} 취소 또는 변경이 불가합니다.`;
      break;
    case 'deposit_forfeit':
      line = `${when} 취소 또는 변경 시 예약금은 반환되지 않습니다.`;
      break;
    case 'custom':
      line = tier.customText?.trim() || '';
      break;
  }
  if (tier.note?.trim()) {
    line = line ? `${line} ${tier.note.trim()}` : tier.note.trim();
  }
  return line.trim();
}

export function renderCancellationPolicyLines(
  policy: OperatingCompanyCancellationPolicy,
): string[] {
  if (!policy.enabled) {
    const fb = policy.fallbackLine?.trim();
    return fb ? [fb] : [];
  }
  const lines: string[] = [];
  const freeChangeLine = renderFreeChangeDaysBeforeLine(policy.freeChangeDaysBefore);
  if (freeChangeLine) lines.push(freeChangeLine);
  const tiers = [...policy.tiers].sort(
    (a, b) => b.daysBefore - a.daysBefore || a.sortOrder - b.sortOrder,
  );
  for (const tier of tiers) {
    const line = renderTierLine(tier);
    if (line) lines.push(line);
  }
  if (!lines.length && policy.fallbackLine?.trim()) {
    lines.push(policy.fallbackLine.trim());
  }
  return lines;
}

export function renderCancellationPolicyText(
  policy: OperatingCompanyCancellationPolicy,
): string {
  return renderCancellationPolicyLines(policy).join('\n');
}

export function renderFreeChangeDaysBeforeLine(
  freeChangeDaysBefore: number | null | undefined,
): string | null {
  if (freeChangeDaysBefore == null || freeChangeDaysBefore <= 0) return null;
  return `날짜 변경은 청소일 기준 ${freeChangeDaysBefore}일 전까지 신청하셔야 위약금 없이 변경 가능합니다.`;
}
