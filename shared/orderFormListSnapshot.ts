/** 접수 목록에 노출할 발주서 추가 항목 스냅샷 — Inquiry.orderFormListSnapshot */

export const ORDER_FORM_INQUIRY_LIST_PROMOTED_MAX = 3;

export type OrderFormListSnapshotEntry = {
  label: string;
  value: string;
};

export type OrderFormListSnapshot = Record<string, OrderFormListSnapshotEntry>;

export type OrderFormPromotedListFieldDef = {
  fieldKey: string;
  label: string;
};

/** 목록·카드 표시용 값 정규화 */
export function formatOrderFormListSnapshotValue(raw: unknown): string {
  if (raw == null) return '';
  if (Array.isArray(raw)) return raw.map((x) => String(x)).filter(Boolean).join(', ');
  if (typeof raw === 'boolean') return raw ? '예' : '아니오';
  return String(raw).trim();
}
