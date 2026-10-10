-- 발급 시 마케터 체크가 있을 때만 고객에게 추가 시공비 안내를 띄운다.
ALTER TABLE "order_forms" ADD COLUMN IF NOT EXISTS "extra_work_notice" BOOLEAN NOT NULL DEFAULT false;
