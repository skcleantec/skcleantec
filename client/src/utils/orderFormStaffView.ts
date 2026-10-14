/** 접수 수정 「발주서」모달 — 고객 화면을 보기만 하고 제출·메일은 막는다. */

export const ORDER_FORM_STAFF_VIEW_PARAM = 'staffView';
export const ORDER_FORM_STAFF_VIEW_CLOSE = 'cbiseo:order-preview-close';

export function isOrderFormStaffView(search: string): boolean {
  const q = search.startsWith('?') ? search.slice(1) : search;
  return new URLSearchParams(q).get(ORDER_FORM_STAFF_VIEW_PARAM) === '1';
}

export function withOrderFormStaffView(url: string): string {
  const u = new URL(url, typeof window !== 'undefined' ? window.location.origin : 'http://localhost');
  u.searchParams.set(ORDER_FORM_STAFF_VIEW_PARAM, '1');
  return u.toString();
}

export function notifyOrderFormStaffViewClose(): void {
  if (typeof window === 'undefined') return;
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({ type: ORDER_FORM_STAFF_VIEW_CLOSE }, window.location.origin);
  }
}
