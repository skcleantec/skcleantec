import {
  buildOrderFormCustomerMessage,
  normalizeMsgConfigForEditor,
  type FormMessagesState,
} from '../../../utils/orderFormCustomerCopy';

/** 도움말 전용 — 실명·실제 고객 데이터 없음 */

export const CUSTOMER_LINK_HELP_DEMO_ORDER = {
  token: 'sample-preview-token',
  customerName: '이○○',
  reviewPaybackToken: 'sample-payback-preview-token',
  totalAmount: 880_000,
  depositAmount: 100_000,
  balanceAmount: 780_000,
  preferredDate: '2026-06-20',
  preferredTime: '오전',
  preferredTimeDetail: '09:00',
  optionNote: '냉장고 내부 청소 포함',
} as const;

export const CUSTOMER_LINK_HELP_DEMO_BRAND = {
  id: 'demo-cl-brand',
  name: 'cbiseo',
  displayName: '청소비서',
  slug: 'cbiseo',
} as const;

export function buildCustomerLinkHelpDemoMsgConfig(): FormMessagesState {
  return normalizeMsgConfigForEditor({
    formTitle: '발주서',
    priceLabel: '(특가)',
    reviewEventText: '* 리뷰 별5점 이벤트 참여, 1만원 입금',
    footerNotice1: '‼️ 청소 전일 저녁, 담당 팀장 연락 드림',
    footerNotice2: '❌ 연락 없을 시, 본사 확인 요청 필수',
    customerLinkMessageTemplate: null,
    infoContent: null,
    infoLinkText: null,
    submitSuccessTitle: null,
    submitSuccessBody: null,
  });
}

export function buildCustomerLinkHelpDemoPreview(
  msgConfig: FormMessagesState,
  origin = 'https://www.cbiseo.com',
): string {
  return buildOrderFormCustomerMessage(
    msgConfig,
    CUSTOMER_LINK_HELP_DEMO_ORDER,
    origin,
    'cbiseo',
    CUSTOMER_LINK_HELP_DEMO_BRAND.slug,
    CUSTOMER_LINK_HELP_DEMO_BRAND.displayName,
  );
}
