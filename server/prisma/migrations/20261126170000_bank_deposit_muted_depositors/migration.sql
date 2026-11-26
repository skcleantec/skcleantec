-- 고정 입금처 (알림 제외 목록)
CREATE TABLE IF NOT EXISTS "bank_deposit_muted_depositors" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "operating_company_id" TEXT,
    "name_norm" VARCHAR(80) NOT NULL,
    "display_name" VARCHAR(80) NOT NULL,
    "kind" VARCHAR(16) NOT NULL DEFAULT 'OTHER',
    "match_mode" VARCHAR(16) NOT NULL DEFAULT 'exact',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "memo" VARCHAR(200),
    "match_count" INTEGER NOT NULL DEFAULT 0,
    "last_matched_at" TIMESTAMP(3),
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_deposit_muted_depositors_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bank_deposit_muted_depositors_tenant_id_operating_company_i_key" ON "bank_deposit_muted_depositors"("tenant_id", "operating_company_id", "name_norm");
CREATE INDEX IF NOT EXISTS "bank_deposit_muted_depositors_tenant_id_enabled_idx" ON "bank_deposit_muted_depositors"("tenant_id", "enabled");

ALTER TABLE "bank_deposit_muted_depositors" ADD CONSTRAINT "bank_deposit_muted_depositors_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_deposit_muted_depositors" ADD CONSTRAINT "bank_deposit_muted_depositors_operating_company_id_fkey" FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "bank_deposit_muted_depositors" ADD CONSTRAINT "bank_deposit_muted_depositors_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
