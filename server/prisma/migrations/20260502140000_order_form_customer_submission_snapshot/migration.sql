-- 고객 발주서 제출 원본 스냅샷 (관리자 조회·향후 고객 재발송용)
ALTER TABLE "order_forms" ADD COLUMN IF NOT EXISTS "customer_submission_snapshot" JSONB;
