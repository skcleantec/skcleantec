-- 플랫폼 수기·링크 결제에서 목록에 없는 청소 업체를 직접 적는다.
ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "external_company_name" VARCHAR(40);
ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "external_company_phone" VARCHAR(32);
