-- 텔레CRM 빠른일정: 정보 가져오기 희망일 답변
CREATE TABLE IF NOT EXISTS "crm_quick_schedule_leads" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "operating_company_id" TEXT NOT NULL,
  "customer_name" VARCHAR(128) NOT NULL,
  "nickname" VARCHAR(128),
  "customer_phone" VARCHAR(32) NOT NULL,
  "customer_phone_digits" VARCHAR(20) NOT NULL,
  "lead_source" VARCHAR(16) NOT NULL,
  "preferred_answer_raw" TEXT NOT NULL,
  "preferred_kind" VARCHAR(16) NOT NULL,
  "preferred_ymd" VARCHAR(10),
  "service_type" VARCHAR(128),
  "address" TEXT,
  "area_pyeong" DOUBLE PRECISION,
  "fetched_at" TIMESTAMP(3) NOT NULL,
  "fetched_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "crm_quick_schedule_leads_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "crm_quick_schedule_leads_tenant_id_operating_company_id_customer_phone_digits_key"
  ON "crm_quick_schedule_leads"("tenant_id", "operating_company_id", "customer_phone_digits");
CREATE INDEX IF NOT EXISTS "crm_quick_schedule_leads_tenant_id_operating_company_id_fetched_at_idx"
  ON "crm_quick_schedule_leads"("tenant_id", "operating_company_id", "fetched_at");

DO $$ BEGIN
  ALTER TABLE "crm_quick_schedule_leads" ADD CONSTRAINT "crm_quick_schedule_leads_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "crm_quick_schedule_leads" ADD CONSTRAINT "crm_quick_schedule_leads_operating_company_id_fkey"
    FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "crm_quick_schedule_leads" ADD CONSTRAINT "crm_quick_schedule_leads_fetched_by_user_id_fkey"
    FOREIGN KEY ("fetched_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
