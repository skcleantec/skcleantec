-- 발주서 발급 후 고객 제출 전 전용 접수 상태 (입금완료 다음 단계)
ALTER TYPE "InquiryStatus" ADD VALUE IF NOT EXISTS 'ORDER_FORM_PENDING';
