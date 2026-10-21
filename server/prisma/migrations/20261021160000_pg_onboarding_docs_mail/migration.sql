ALTER TABLE "tenant_pg_onboardings" ADD COLUMN IF NOT EXISTS "merchant_kind" VARCHAR(16);
ALTER TABLE "tenant_pg_onboardings" ADD COLUMN IF NOT EXISTS "bankbook_image_url" VARCHAR(2048);
ALTER TABLE "tenant_pg_onboardings" ADD COLUMN IF NOT EXISTS "bankbook_image_public_id" VARCHAR(512);
ALTER TABLE "tenant_pg_onboardings" ADD COLUMN IF NOT EXISTS "id_card_image_url" VARCHAR(2048);
ALTER TABLE "tenant_pg_onboardings" ADD COLUMN IF NOT EXISTS "id_card_image_public_id" VARCHAR(512);
ALTER TABLE "tenant_pg_onboardings" ADD COLUMN IF NOT EXISTS "contract_mailed_at" TIMESTAMP(3);
