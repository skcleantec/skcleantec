/** 고객 발주서 링크 안내 메시지 — 링크 URL 제외 편집 가능 문구 기본값 */
export const ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS = {
  customerLinkTotalLine: '총 금액 {{amount}}원 {{priceLabel}}',
  customerLinkBalanceLine: '잔금 {{balance}}원, 예약금 {{deposit}}원',
  customerLinkScheduleLine: '청소일시: {{date}} ({{timeSlot}})',
  customerLinkTimeDetailLine: '희망 시각: {{timeDetail}}',
  customerLinkOrderIntro: '아래 링크에서 예약확정서를 작성해 주세요.',
  customerLinkCsNotice:
    '청소 후 청소팀 태도, 고객 불편 관련 신고는 본사에 직접 요청해주시면 바로 시정처리 해드리겠습니다.',
  customerLinkCsUrlLabel: '신고 URL:',
  customerLinkPaybackBlock: `★ 리뷰 페이백 신청 (전화·카톡 확인 없이 링크에서만 접수됩니다)
리뷰 작성 후 반드시 아래 링크에 접속해 캡처·계좌를 등록해 주세요.
전화나 메시지로 보내주시면 확인이 지연될 수 있습니다.

페이백 신청: {{paybackLink}}`,
} as const;

export type CustomerLinkCopyFieldKey = keyof typeof ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS;

export type CustomerLinkCopyConfig = Record<CustomerLinkCopyFieldKey, string>;

export type CustomerLinkCopyConfigInput = Partial<Record<CustomerLinkCopyFieldKey, string | null>>;

function line(raw: string | null | undefined, fallback: string): string {
  const t = raw != null ? String(raw).trim() : '';
  return t || fallback;
}

/** DB/API 값 → 메시지 빌드용(빈 값은 기본 문구) */
export function resolveCustomerLinkCopy(input: CustomerLinkCopyConfigInput | null | undefined): CustomerLinkCopyConfig {
  const d = ORDER_FORM_CUSTOMER_LINK_COPY_DEFAULTS;
  return {
    customerLinkTotalLine: line(input?.customerLinkTotalLine, d.customerLinkTotalLine),
    customerLinkBalanceLine: line(input?.customerLinkBalanceLine, d.customerLinkBalanceLine),
    customerLinkScheduleLine: line(input?.customerLinkScheduleLine, d.customerLinkScheduleLine),
    customerLinkTimeDetailLine: line(input?.customerLinkTimeDetailLine, d.customerLinkTimeDetailLine),
    customerLinkOrderIntro: line(input?.customerLinkOrderIntro, d.customerLinkOrderIntro),
    customerLinkCsNotice: line(input?.customerLinkCsNotice, d.customerLinkCsNotice),
    customerLinkCsUrlLabel: line(input?.customerLinkCsUrlLabel, d.customerLinkCsUrlLabel),
    customerLinkPaybackBlock: line(input?.customerLinkPaybackBlock, d.customerLinkPaybackBlock),
  };
}

/** `{{amount}}` 등 치환 — 링크 URL은 호출부에서 vars 로 전달 */
export function applyCustomerLinkTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? '');
}
