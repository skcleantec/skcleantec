-- 가맹점별 수수료. 서비스브릿지 원가 기본 2.60% → 2.62% (부가세 포함).
ALTER TABLE "tenant_pg_onboardings" ADD COLUMN IF NOT EXISTS "fee_bps" INTEGER;
ALTER TABLE "tenant_pg_onboardings" ADD COLUMN IF NOT EXISTS "merchant_deleted_at" TIMESTAMP(3);

UPDATE "platform_card_payment_settings"
SET "platform_cost_bps" = 262
WHERE "id" = 'default' AND "platform_cost_bps" = 260;
