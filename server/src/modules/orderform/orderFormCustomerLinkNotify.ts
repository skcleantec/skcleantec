import { broadcastJsonToStaff } from '../realtime/realtimeHub.js';

/** WS — 고객 링크 설정 저장 시 동일 테넌트 스태ff 캐시 무효화 신호 */
export const ORDER_FORM_CUSTOMER_LINK_WS_TYPE = 'orderform:customerLinkConfigRefresh' as const;

export type OrderFormCustomerLinkConfigWsPayload = {
  type: typeof ORDER_FORM_CUSTOMER_LINK_WS_TYPE;
  /** 브랜드별 저장 시 ID. 없으면 테넌트 폴백·전체 갱신 */
  operatingCompanyId?: string | null;
};

/** 고객 링크 설정 변경 — 연결된 ADMIN·MARKETER 탭에 즉시 반영 (저장 API와 분리, 실패해도 저장은 성공) */
export function notifyOrderFormCustomerLinkConfigRefresh(
  tenantId: string,
  operatingCompanyId?: string | null,
): void {
  const payload: OrderFormCustomerLinkConfigWsPayload = {
    type: ORDER_FORM_CUSTOMER_LINK_WS_TYPE,
    operatingCompanyId: operatingCompanyId?.trim() || null,
  };
  try {
    broadcastJsonToStaff(payload, tenantId);
  } catch (err) {
    console.error('orderFormCustomerLinkConfig WS notify error:', err);
  }
}
