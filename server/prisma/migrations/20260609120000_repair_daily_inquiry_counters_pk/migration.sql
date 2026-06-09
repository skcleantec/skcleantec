-- Idempotent: daily_inquiry_counters PK를 (tenant_id, operating_company_id, date_key)로 맞춤
-- 운영 DB 복원·스테이징 가져오기 시 이전 마이그레이션 기록만 있고 PK가 갱신 안 된 드리프트 대응

ALTER TABLE "daily_inquiry_counters" ADD COLUMN IF NOT EXISTS "operating_company_id" TEXT;

UPDATE "daily_inquiry_counters" dic
SET "operating_company_id" = oc."id"
FROM "operating_companies" oc
WHERE oc."tenant_id" = dic."tenant_id"
  AND oc."is_default" = true
  AND dic."operating_company_id" IS NULL;

UPDATE "daily_inquiry_counters" dic
SET "operating_company_id" = sub."id"
FROM (
  SELECT DISTINCT ON (oc."tenant_id") oc."tenant_id", oc."id"
  FROM "operating_companies" oc
  WHERE oc."is_active" = true
  ORDER BY oc."tenant_id", oc."sort_order" ASC, oc."created_at" ASC
) sub
WHERE dic."tenant_id" = sub."tenant_id"
  AND dic."operating_company_id" IS NULL;

DELETE FROM "daily_inquiry_counters" WHERE "operating_company_id" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = ANY (c.conkey)
    WHERE t.relname = 'daily_inquiry_counters'
      AND c.contype = 'p'
      AND a.attname = 'operating_company_id'
  ) THEN
    ALTER TABLE "daily_inquiry_counters" DROP CONSTRAINT IF EXISTS "daily_inquiry_counters_pkey";
    ALTER TABLE "daily_inquiry_counters" ADD CONSTRAINT "daily_inquiry_counters_pkey"
      PRIMARY KEY ("tenant_id", "operating_company_id", "date_key");
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'daily_inquiry_counters_operating_company_id_fkey'
  ) THEN
    ALTER TABLE "daily_inquiry_counters"
      ADD CONSTRAINT "daily_inquiry_counters_operating_company_id_fkey"
      FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

ALTER TABLE "daily_inquiry_counters" ALTER COLUMN "operating_company_id" SET NOT NULL;
