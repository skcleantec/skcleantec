ALTER TABLE "tenant_pg_onboardings" ADD COLUMN IF NOT EXISTS "seller_center_login_id" VARCHAR(64);
ALTER TABLE "tenant_pg_onboardings" ADD COLUMN IF NOT EXISTS "seller_center_password_enc" TEXT;
