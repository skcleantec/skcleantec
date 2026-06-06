-- 발주서 발급 시 영업 브랜드 고정(고객 URL·제출 귀속)
ALTER TABLE "order_forms" ADD COLUMN IF NOT EXISTS "operating_company_id" TEXT;

UPDATE "order_forms" AS of
SET "operating_company_id" = i."operating_company_id"
FROM "inquiries" AS i
WHERE i."order_form_id" = of."id"
  AND i."operating_company_id" IS NOT NULL
  AND of."operating_company_id" IS NULL;

UPDATE "order_forms" AS of
SET "operating_company_id" = oc."id"
FROM "operating_companies" AS oc
WHERE of."operating_company_id" IS NULL
  AND oc."tenant_id" = of."tenant_id"
  AND oc."is_default" = true;

UPDATE "order_forms" AS of
SET "operating_company_id" = oc."id"
FROM "operating_companies" AS oc
WHERE of."operating_company_id" IS NULL
  AND oc."tenant_id" = of."tenant_id"
  AND oc."is_active" = true
  AND oc."id" = (
    SELECT oc2."id"
    FROM "operating_companies" AS oc2
    WHERE oc2."tenant_id" = of."tenant_id" AND oc2."is_active" = true
    ORDER BY oc2."sort_order" ASC, oc2."created_at" ASC
    LIMIT 1
  );

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
