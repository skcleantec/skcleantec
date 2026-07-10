-- 숨고 견적보내기(auto_quote) — 브랜드별 서식 + 페이백 금액
ALTER TABLE "telecrm_soomgo_message_presets"
  ADD COLUMN IF NOT EXISTS "operating_company_id" TEXT,
  ADD COLUMN IF NOT EXISTS "payback_won" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'telecrm_soomgo_message_presets_operating_company_id_fkey'
  ) THEN
    ALTER TABLE "telecrm_soomgo_message_presets"
      ADD CONSTRAINT "telecrm_soomgo_message_presets_operating_company_id_fkey"
      FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "telecrm_soomgo_auto_quote_tenant_default_key"
  ON "telecrm_soomgo_message_presets" ("tenant_id")
  WHERE "trigger_kind" = 'auto_quote' AND "operating_company_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "telecrm_soomgo_auto_quote_brand_key"
  ON "telecrm_soomgo_message_presets" ("tenant_id", "operating_company_id")
  WHERE "trigger_kind" = 'auto_quote' AND "operating_company_id" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "telecrm_soomgo_message_presets_tenant_brand_trigger_idx"
  ON "telecrm_soomgo_message_presets" ("tenant_id", "operating_company_id", "trigger_kind");
