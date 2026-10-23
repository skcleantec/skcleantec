ALTER TABLE "platform_card_payment_settings"
  ADD COLUMN IF NOT EXISTS "pg_contract_title" VARCHAR(128) NOT NULL DEFAULT '카드결제 이용약관',
  ADD COLUMN IF NOT EXISTS "pg_contract_body_html" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "pg_contract_fields" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "tenant_pg_onboardings"
  ADD COLUMN IF NOT EXISTS "contract_signed_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "contract_values" JSONB;
