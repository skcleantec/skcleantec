import type { Inquiry, Prisma } from '@prisma/client';

/** 고객·일정 중심 부분 전달 프리셋 (금액·메모 제외) */
export const SHARE_FIELD_PRESET_CUSTOMER_SCHEDULE = [
  'customerName',
  'nickname',
  'customerPhone',
  'customerPhone2',
  'address',
  'addressDetail',
  'addressGeoQuery',
  'addressGeoLat',
  'addressGeoLng',
  'propertyType',
  'areaPyeong',
  'areaBasis',
  'exclusiveAreaSqm',
  'isOneRoom',
  'roomCount',
  'bathroomCount',
  'balconyCount',
  'kitchenCount',
  'preferredDate',
  'preferredTime',
  'preferredTimeDetail',
  'betweenScheduleSlot',
  'buildingType',
  'moveInDate',
  'moveInDateUndecided',
] as const;

export type ShareFieldKey = (typeof SHARE_FIELD_PRESET_CUSTOMER_SCHEDULE)[number] | string;

const ALLOWED_MASK_KEYS = new Set<string>([
  ...SHARE_FIELD_PRESET_CUSTOMER_SCHEDULE,
  'callAttempt',
  'claimMemo',
  'scheduleMemo',
  'consultationMemo',
  'memo',
  'specialNotes',
  'serviceTotalAmount',
  'serviceDepositAmount',
  'serviceBalanceAmount',
]);

export function normalizeShareFieldMask(raw: unknown): string[] | null {
  if (raw == null) return null;
  if (!Array.isArray(raw)) return null;
  const keys = raw
    .filter((x): x is string => typeof x === 'string')
    .map((k) => k.trim())
    .filter((k) => ALLOWED_MASK_KEYS.has(k));
  return keys.length > 0 ? [...new Set(keys)] : null;
}

export function applyFieldMaskToMirrorData(
  full: Prisma.InquiryUncheckedCreateInput,
  mask: string[] | null,
): Prisma.InquiryUncheckedCreateInput {
  if (!mask || mask.length === 0) return full;
  const out: Prisma.InquiryUncheckedCreateInput = {
    tenantId: full.tenantId,
    operatingCompanyId: full.operatingCompanyId,
    inquiryNumber: full.inquiryNumber,
    source: full.source,
    status: full.status,
    customerName: full.customerName,
    customerPhone: full.customerPhone,
    address: full.address,
  };
  for (const key of mask) {
    if (key in full && key !== 'tenantId' && key !== 'operatingCompanyId' && key !== 'inquiryNumber') {
      (out as Record<string, unknown>)[key] = (full as Record<string, unknown>)[key];
    }
  }
  return out;
}

export function filterKeysByShareMask(keys: string[], mask: string[] | null | undefined): string[] {
  if (!mask || mask.length === 0) return keys;
  const allowed = new Set(mask);
  return keys.filter((k) => allowed.has(k) || k === 'status');
}

export function shareMaskFromPreset(preset: unknown): string[] | null {
  if (preset === 'customer_schedule') return [...SHARE_FIELD_PRESET_CUSTOMER_SCHEDULE];
  return null;
}
