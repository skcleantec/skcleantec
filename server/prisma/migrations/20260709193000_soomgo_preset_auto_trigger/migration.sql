-- 숨고 프리셋 — 부재·보류 자동 안내 트리거 (기존 followup 컬럼 → 프리셋 steps)
ALTER TABLE "telecrm_soomgo_message_presets"
  ADD COLUMN "trigger_kind" VARCHAR(20);

CREATE UNIQUE INDEX "telecrm_soomgo_message_presets_tenant_auto_trigger_key"
  ON "telecrm_soomgo_message_presets" ("tenant_id", "trigger_kind")
  WHERE "trigger_kind" IN ('auto_absent', 'auto_hold');

INSERT INTO "telecrm_soomgo_message_presets" (
  "id", "tenant_id", "owner_user_id", "slot_number", "label", "steps_json",
  "sort_order", "is_active", "trigger_kind", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  c."tenant_id",
  NULL,
  0,
  '부재 자동 안내',
  CASE
    WHEN COALESCE(TRIM(c."followup_absent_message"), '') <> '' THEN
      json_build_array(json_build_object('type', 'text', 'text', TRIM(c."followup_absent_message")))::text
    ELSE '[]'
  END,
  0,
  c."followup_absent_auto_enabled",
  'auto_absent',
  NOW(),
  NOW()
FROM "telecrm_soomgo_configs" c
WHERE NOT EXISTS (
  SELECT 1 FROM "telecrm_soomgo_message_presets" p
  WHERE p."tenant_id" = c."tenant_id" AND p."trigger_kind" = 'auto_absent'
);

INSERT INTO "telecrm_soomgo_message_presets" (
  "id", "tenant_id", "owner_user_id", "slot_number", "label", "steps_json",
  "sort_order", "is_active", "trigger_kind", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  c."tenant_id",
  NULL,
  0,
  '보류·고민 자동 안내',
  CASE
    WHEN COALESCE(TRIM(c."followup_hold_message"), '') <> '' THEN
      json_build_array(json_build_object('type', 'text', 'text', TRIM(c."followup_hold_message")))::text
    ELSE '[]'
  END,
  0,
  c."followup_hold_auto_enabled",
  'auto_hold',
  NOW(),
  NOW()
FROM "telecrm_soomgo_configs" c
WHERE NOT EXISTS (
  SELECT 1 FROM "telecrm_soomgo_message_presets" p
  WHERE p."tenant_id" = c."tenant_id" AND p."trigger_kind" = 'auto_hold'
);
