-- CRM 통화 시 숨고 자동 안내 — 마케터 개인·브랜드별 (auto_call)

CREATE UNIQUE INDEX IF NOT EXISTS "telecrm_soomgo_call_auto_personal_default_key"
  ON "telecrm_soomgo_message_presets" ("tenant_id", "owner_user_id", "trigger_kind")
  WHERE "trigger_kind" = 'auto_call'
  AND "operating_company_id" IS NULL
  AND "owner_user_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "telecrm_soomgo_call_auto_personal_brand_key"
  ON "telecrm_soomgo_message_presets" ("tenant_id", "owner_user_id", "operating_company_id", "trigger_kind")
  WHERE "trigger_kind" = 'auto_call'
  AND "operating_company_id" IS NOT NULL
  AND "owner_user_id" IS NOT NULL;
