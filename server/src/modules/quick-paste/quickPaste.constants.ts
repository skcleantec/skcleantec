/** 빠른등록 — 코인·필수 필드 (Phase 1) */

export const QUICK_PASTE_COIN_COST = 2;

export const QUICK_PASTE_REQUIRED_FIELDS = [
  'customerName',
  'customerPhone',
  'address',
  'preferredDate',
  'serviceBalanceAmount',
  'areaPyeong',
] as const;

export type QuickPasteFieldKey = (typeof QUICK_PASTE_REQUIRED_FIELDS)[number];

export const QUICK_PASTE_FIELD_LABELS: Record<QuickPasteFieldKey, string> = {
  customerName: '고객명',
  customerPhone: '연락처',
  address: '주소',
  preferredDate: '희망일',
  serviceBalanceAmount: '청소 잔금',
  areaPyeong: '평수',
};

/** 선택 — 방·화·베란다 (규칙/AI 보조, 미입력 시 등록 가능) */
export const QUICK_PASTE_OPTIONAL_FIELDS = ['roomCount', 'bathroomCount', 'balconyCount'] as const;

export type QuickPasteOptionalFieldKey = (typeof QUICK_PASTE_OPTIONAL_FIELDS)[number];

export const QUICK_PASTE_OPTIONAL_FIELD_LABELS: Record<QuickPasteOptionalFieldKey, string> = {
  roomCount: '방',
  bathroomCount: '화장실',
  balconyCount: '베란다',
};
