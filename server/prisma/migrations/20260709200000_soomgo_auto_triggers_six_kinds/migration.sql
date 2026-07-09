-- 숨고 자동메시지 — 처리 구분 6종 트리거 확장
DROP INDEX IF EXISTS "telecrm_soomgo_message_presets_tenant_auto_trigger_key";

CREATE UNIQUE INDEX "telecrm_soomgo_message_presets_tenant_auto_trigger_key"
  ON "telecrm_soomgo_message_presets" ("tenant_id", "trigger_kind")
  WHERE "trigger_kind" IN (
    'auto_requested',
    'auto_absent',
    'auto_hold',
    'auto_deposit',
    'auto_reserved',
    'auto_received'
  );

INSERT INTO "telecrm_soomgo_message_presets" (
  "id", "tenant_id", "owner_user_id", "slot_number", "label", "steps_json",
  "sort_order", "is_active", "trigger_kind", "created_at", "updated_at"
)
SELECT gen_random_uuid()::text, t."id", NULL, 0, v.label, '[]', v.sort_order, false, v.trigger_kind, NOW(), NOW()
FROM "tenants" t
CROSS JOIN (
  VALUES
    ('auto_requested', '요청 자동 안내', 0),
    ('auto_deposit', '예약금 대기 자동 안내', 3),
    ('auto_reserved', '입금 완료 자동 안내', 4),
    ('auto_received', '예약완료 자동 안내', 5)
) AS v(trigger_kind, label, sort_order)
WHERE NOT EXISTS (
  SELECT 1 FROM "telecrm_soomgo_message_presets" p
  WHERE p."tenant_id" = t."id" AND p."trigger_kind" = v.trigger_kind
);

UPDATE "telecrm_soomgo_message_presets"
SET "sort_order" = CASE "trigger_kind"
  WHEN 'auto_requested' THEN 0
  WHEN 'auto_absent' THEN 1
  WHEN 'auto_hold' THEN 2
  WHEN 'auto_deposit' THEN 3
  WHEN 'auto_reserved' THEN 4
  WHEN 'auto_received' THEN 5
  ELSE "sort_order"
END
WHERE "trigger_kind" IN (
  'auto_requested', 'auto_absent', 'auto_hold', 'auto_deposit', 'auto_reserved', 'auto_received'
);
