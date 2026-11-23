-- 발주서 추가 시공(이름·금액). 없으면 기존 총액만 사용.
ALTER TABLE "order_forms" ADD COLUMN IF NOT EXISTS "extra_works" JSONB;
ALTER TABLE "order_forms" ADD COLUMN IF NOT EXISTS "base_amount" INTEGER;

-- 고객 제출로 접수가 만들어질 때 같은 내역을 접수 행에도 남긴다.
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "extra_works" JSONB;
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "base_amount" INTEGER;
