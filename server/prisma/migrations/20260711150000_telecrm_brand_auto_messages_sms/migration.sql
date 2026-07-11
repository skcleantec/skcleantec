-- 접수 처리 6종 숨고 자동메시지 — 브랜드별 오버라이드 + SMS 템플릿 브랜드

DROP INDEX IF EXISTS "telecrm_soomgo_message_presets_tenant_auto_trigger_key";

CREATE UNIQUE INDEX IF NOT EXISTS "telecrm_soomgo_intake_auto_tenant_default_key"
  ON "telecrm_soomgo_message_presets" ("tenant_id", "trigger_kind")
  WHERE "trigger_kind" IN (
    'auto_requested', 'auto_absent', 'auto_hold',
    'auto_deposit', 'auto_reserved', 'auto_received'
  )
  AND "operating_company_id" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "telecrm_soomgo_intake_auto_brand_key"
  ON "telecrm_soomgo_message_presets" ("tenant_id", "operating_company_id", "trigger_kind")
  WHERE "trigger_kind" IN (
    'auto_requested', 'auto_absent', 'auto_hold',
    'auto_deposit', 'auto_reserved', 'auto_received'
  )
  AND "operating_company_id" IS NOT NULL;

ALTER TABLE "telecrm_sms_templates"
  ADD COLUMN IF NOT EXISTS "operating_company_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'telecrm_sms_templates_operating_company_id_fkey'
  ) THEN
    ALTER TABLE "telecrm_sms_templates"
      ADD CONSTRAINT "telecrm_sms_templates_operating_company_id_fkey"
      FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "telecrm_sms_templates_tenant_brand_idx"
  ON "telecrm_sms_templates" ("tenant_id", "operating_company_id");
