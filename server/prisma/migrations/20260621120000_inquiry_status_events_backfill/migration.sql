-- 기존 RECEIVED 접수 1건당 전환 이벤트 backfill (발주서 제출 시각 우선)
INSERT INTO "inquiry_status_events" ("id", "tenant_id", "inquiry_id", "status", "occurred_at", "actor_id")
SELECT
  gen_random_uuid()::text,
  i."tenant_id",
  i."id",
  'RECEIVED'::"InquiryStatus",
  COALESCE(of."submitted_at", i."updated_at", i."created_at"),
  i."created_by_id"
FROM "inquiries" i
LEFT JOIN "order_forms" of ON of."id" = i."order_form_id"
WHERE i."status" = 'RECEIVED'
  AND NOT EXISTS (
    SELECT 1
    FROM "inquiry_status_events" e
    WHERE e."inquiry_id" = i."id"
      AND e."status" = 'RECEIVED'
  );
