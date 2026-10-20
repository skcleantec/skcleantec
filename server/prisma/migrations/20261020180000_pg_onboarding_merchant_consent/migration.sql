-- 가맹 PG 신청: 법인·개인사업자만, 명함, 제3자·불법이용 동의 시각
ALTER TABLE "tenant_pg_onboardings" ADD COLUMN IF NOT EXISTS "business_kind" VARCHAR(32);
ALTER TABLE "tenant_pg_onboardings" ADD COLUMN IF NOT EXISTS "business_card_image_url" TEXT;
ALTER TABLE "tenant_pg_onboardings" ADD COLUMN IF NOT EXISTS "business_card_image_public_id" VARCHAR(256);
ALTER TABLE "tenant_pg_onboardings" ADD COLUMN IF NOT EXISTS "consent_terms_at" TIMESTAMP(3);
ALTER TABLE "tenant_pg_onboardings" ADD COLUMN IF NOT EXISTS "consent_privacy_at" TIMESTAMP(3);
ALTER TABLE "tenant_pg_onboardings" ADD COLUMN IF NOT EXISTS "consent_third_party_at" TIMESTAMP(3);
ALTER TABLE "tenant_pg_onboardings" ADD COLUMN IF NOT EXISTS "consent_illegal_use_at" TIMESTAMP(3);
ALTER TABLE "tenant_pg_onboardings" ADD COLUMN IF NOT EXISTS "consent_marketing_at" TIMESTAMP(3);
