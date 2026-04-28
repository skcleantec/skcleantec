import {
  ORDER_FORM_TIME_SLOT_ACK_BODY_DEFAULT,
  ORDER_FORM_TIME_SLOT_ACK_CONSENT_HINT_DEFAULT,
} from './orderFormTimeSlotAckDefaults.js';

/** `orderform.routes` 기본 폼 설정과 동일해야 함 */
export const ORDER_FORM_CONFIG_DEFAULTS = {
  formTitle: 'SK클린텍 입주청소 발주서',
  priceLabel: '(특가)',
  reviewEventText: '* 리뷰 별5점 이벤트 참여, 1만원 입금',
  footerNotice1: '‼️ 청소 전일 저녁, 담당 팀장 연락 드림',
  footerNotice2: '❌ 연락 없을 시, 본사 확인 요청 필',
  infoLinkText: '고객 정보처리 동의 및 안내사항',
  submitSuccessTitle: '제출이 완료되었습니다.',
  submitSuccessBody: '청소 전일 저녁, 담당 팀장이 연락드립니다.',
  timeSlotAckTitle: '시간대 선택 전 안내',
  timeSlotAckBody: ORDER_FORM_TIME_SLOT_ACK_BODY_DEFAULT,
  timeSlotAckConsentHint: ORDER_FORM_TIME_SLOT_ACK_CONSENT_HINT_DEFAULT,
} as const;
