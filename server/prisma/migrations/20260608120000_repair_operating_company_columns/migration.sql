-- Idempotent repair: operating_company_id columns missing despite prior migration record (shared DB drift)
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "operating_company_id" TEXT;

UPDATE "inquiries" i
SET "operating_company_id" = oc."id"
FROM "operating_companies" oc
WHERE oc."tenant_id" = i."tenant_id"
  AND oc."is_default" = true
  AND i."operating_company_id" IS NULL;

UPDATE "inquiries" i
SET "operating_company_id" = sub."id"
FROM (
  SELECT DISTINCT ON (oc."tenant_id") oc."tenant_id", oc."id"
  FROM "operating_companies" oc
  WHERE oc."is_active" = true
  ORDER BY oc."tenant_id", oc."sort_order" ASC, oc."created_at" ASC
) sub
WHERE i."tenant_id" = sub."tenant_id"
  AND i."operating_company_id" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inquiries_operating_company_id_fkey'
  ) THEN
    ALTER TABLE "inquiries"
      ADD CONSTRAINT "inquiries_operating_company_id_fkey"
      FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "inquiries_tenant_id_operating_company_id_created_at_idx"
  ON "inquiries"("tenant_id", "operating_company_id", "created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "inquiries" WHERE "operating_company_id" IS NULL
  ) THEN
    ALTER TABLE "inquiries" ALTER COLUMN "operating_company_id" SET NOT NULL;
  END IF;
END $$;

ALTER TABLE "order_forms" ADD COLUMN IF NOT EXISTS "operating_company_id" TEXT;

UPDATE "order_forms" of
SET "operating_company_id" = i."operating_company_id"
FROM "inquiries" i
WHERE i."order_form_id" = of."id"
  AND i."operating_company_id" IS NOT NULL
  AND of."operating_company_id" IS NULL;

UPDATE "order_forms" of
SET "operating_company_id" = oc."id"
FROM "operating_companies" oc
WHERE of."operating_company_id" IS NULL
  AND oc."tenant_id" = of."tenant_id"
  AND oc."is_default" = true;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_forms_operating_company_id_fkey'
  ) THEN
    ALTER TABLE "order_forms"
      ADD CONSTRAINT "order_forms_operating_company_id_fkey"
      FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "order_forms_tenant_id_operating_company_id_idx"
  ON "order_forms"("tenant_id", "operating_company_id");

ALTER TABLE "daily_inquiry_counters" ADD COLUMN IF NOT EXISTS "operating_company_id" TEXT;

UPDATE "daily_inquiry_counters" dic
SET "operating_company_id" = oc."id"
FROM "operating_companies" oc
WHERE oc."tenant_id" = dic."tenant_id"
  AND oc."is_default" = true
  AND dic."operating_company_id" IS NULL;
