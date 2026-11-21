-- 텔레CRM 면적 기준·상담사 사례 (이름·전화번호 없음)
CREATE TABLE IF NOT EXISTS "telecrm_area_rules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "operating_company_id" TEXT,
    "kind" VARCHAR(32) NOT NULL,
    "spec" JSONB NOT NULL,
    "summary" VARCHAR(200) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "telecrm_area_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "telecrm_area_cases" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "operating_company_id" TEXT,
    "address_key" VARCHAR(80) NOT NULL,
    "customer_value" DOUBLE PRECISION NOT NULL,
    "customer_mark" VARCHAR(16),
    "supply_pyeong" DOUBLE PRECISION NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telecrm_area_cases_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "telecrm_area_rules_tenant_id_operating_company_id_is_active_idx"
  ON "telecrm_area_rules"("tenant_id", "operating_company_id", "is_active");
CREATE INDEX IF NOT EXISTS "telecrm_area_cases_tenant_id_operating_company_id_address_key_idx"
  ON "telecrm_area_cases"("tenant_id", "operating_company_id", "address_key");

DO $$ BEGIN
  ALTER TABLE "telecrm_area_rules"
    ADD CONSTRAINT "telecrm_area_rules_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "telecrm_area_cases"
    ADD CONSTRAINT "telecrm_area_cases_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
