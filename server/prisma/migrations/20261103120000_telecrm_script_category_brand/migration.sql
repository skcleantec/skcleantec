-- 상담 스크립트 카테고리 작업 브랜드. null = 모든 브랜드 공통 (기존 행은 null).
ALTER TABLE "telecrm_script_categories" ADD COLUMN IF NOT EXISTS "operating_company_id" TEXT;

CREATE INDEX IF NOT EXISTS "telecrm_script_categories_tenant_id_operating_company_id_idx"
  ON "telecrm_script_categories"("tenant_id", "operating_company_id");

DO $$ BEGIN
  ALTER TABLE "telecrm_script_categories"
    ADD CONSTRAINT "telecrm_script_categories_operating_company_id_fkey"
    FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
