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
