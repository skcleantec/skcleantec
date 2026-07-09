-- CRM 작업 브랜드 스코프: 부재·상담 견적에 operating_company_id

ALTER TABLE "order_followups" ADD COLUMN "operating_company_id" TEXT;

UPDATE "order_followups" f
SET "operating_company_id" = COALESCE(
  (SELECT i."operating_company_id" FROM "inquiries" i WHERE i."id" = f."inquiry_id"),
  (
    SELECT uoc."operating_company_id"
    FROM "user_operating_companies" uoc
    WHERE uoc."user_id" = f."created_by_id" AND uoc."is_primary" = true
    LIMIT 1
  ),
  (
    SELECT oc."id"
    FROM "operating_companies" oc
    WHERE oc."tenant_id" = f."tenant_id" AND oc."is_default" = true
    LIMIT 1
  ),
  (
    SELECT oc."id"
    FROM "operating_companies" oc
    WHERE oc."tenant_id" = f."tenant_id" AND oc."is_active" = true
    ORDER BY oc."sort_order" ASC, oc."created_at" ASC
    LIMIT 1
  )
);

ALTER TABLE "order_followups" ALTER COLUMN "operating_company_id" SET NOT NULL;

ALTER TABLE "order_followups" ADD CONSTRAINT "order_followups_operating_company_id_fkey"
  FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "order_followups_tenant_id_operating_company_id_updated_at_idx"
  ON "order_followups"("tenant_id", "operating_company_id", "updated_at");

-- TelecrmConsultationQuote
ALTER TABLE "telecrm_consultation_quotes" ADD COLUMN "operating_company_id" TEXT;

UPDATE "telecrm_consultation_quotes" q
SET "operating_company_id" = COALESCE(
  (SELECT f."operating_company_id" FROM "order_followups" f WHERE f."id" = q."followup_id"),
  (SELECT i."operating_company_id" FROM "inquiries" i WHERE i."id" = q."inquiry_id"),
  (
    SELECT uoc."operating_company_id"
    FROM "user_operating_companies" uoc
    WHERE uoc."user_id" = q."created_by_id" AND uoc."is_primary" = true
    LIMIT 1
  ),
  (
    SELECT oc."id"
    FROM "operating_companies" oc
    WHERE oc."tenant_id" = q."tenant_id" AND oc."is_default" = true
    LIMIT 1
  ),
  (
    SELECT oc."id"
    FROM "operating_companies" oc
    WHERE oc."tenant_id" = q."tenant_id" AND oc."is_active" = true
    ORDER BY oc."sort_order" ASC, oc."created_at" ASC
    LIMIT 1
  )
);

ALTER TABLE "telecrm_consultation_quotes" ALTER COLUMN "operating_company_id" SET NOT NULL;

ALTER TABLE "telecrm_consultation_quotes" ADD CONSTRAINT "telecrm_consultation_quotes_operating_company_id_fkey"
  FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "telecrm_consultation_quotes_tenant_id_operating_company_id_phone_idx"
  ON "telecrm_consultation_quotes"("tenant_id", "operating_company_id", "phone", "updated_at" DESC);

CREATE INDEX "telecrm_consultation_quotes_tenant_id_operating_company_id_status_phone_idx"
  ON "telecrm_consultation_quotes"("tenant_id", "operating_company_id", "status", "phone");
