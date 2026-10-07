-- 이용료 카드 승인 당일 전액 취소
ALTER TYPE "UsageFeeCardPaymentStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';
