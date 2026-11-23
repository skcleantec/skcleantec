-- 텔레CRM AI 견적 복층 추가금 (브랜드별). 줄이 없으면 코드 기본값 3만 원.
CREATE TABLE IF NOT EXISTS "telecrm_ai_quote_loft_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "amount_won" INTEGER NOT NULL DEFAULT 30000,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telecrm_ai_quote_loft_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "telecrm_ai_quote_loft_settings_tenant_id_operating_company_id_key"
  ON "telecrm_ai_quote_loft_settings"("tenant_id", "operating_company_id");

DO $$ BEGIN
  ALTER TABLE "telecrm_ai_quote_loft_settings"
    ADD CONSTRAINT "telecrm_ai_quote_loft_settings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "telecrm_ai_quote_loft_settings"
    ADD CONSTRAINT "telecrm_ai_quote_loft_settings_operating_company_id_fkey"
    FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
