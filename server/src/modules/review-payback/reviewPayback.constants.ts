export const REVIEW_PAYBACK_WS_TYPE = 'review-payback:new' as const;

export const REVIEW_PAYBACK_LOG_PREFIX = '[페이백/리뷰]';

export const REVIEW_PAYBACK_STATUSES = ['PENDING', 'VERIFIED', 'PAID', 'REJECTED'] as const;

export type ReviewPaybackStatusCode = (typeof REVIEW_PAYBACK_STATUSES)[number];

export const REVIEW_PAYBACK_STATUS_LABEL: Record<ReviewPaybackStatusCode, string> = {
  PENDING: '신청 접수',
  VERIFIED: '리뷰 확인',
  PAID: '입금 완료',
  REJECTED: '반려',
};
