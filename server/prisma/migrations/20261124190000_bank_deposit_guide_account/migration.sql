-- 브랜드마다 고객에게 안내할 입금 계좌 하나
CREATE TABLE IF NOT EXISTS "bank_deposit_guide_accounts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "bank_name" VARCHAR(20) NOT NULL,
    "account_number" VARCHAR(30) NOT NULL,
    "account_holder" VARCHAR(40) NOT NULL,
    "updated_by_user_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_deposit_guide_accounts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bank_deposit_guide_accounts_tenant_id_operating_company_id_key"
  ON "bank_deposit_guide_accounts"("tenant_id", "operating_company_id");

DO $$ BEGIN
  ALTER TABLE "bank_deposit_guide_accounts" ADD CONSTRAINT "bank_deposit_guide_accounts_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "bank_deposit_guide_accounts" ADD CONSTRAINT "bank_deposit_guide_accounts_operating_company_id_fkey"
    FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "bank_deposit_guide_accounts" ADD CONSTRAINT "bank_deposit_guide_accounts_updated_by_user_id_fkey"
    FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
