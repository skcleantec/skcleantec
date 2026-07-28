-- Tenant coin ledger (monthly allowance tracking, idempotent charges)

CREATE TYPE "TenantCoinLedgerSourceType" AS ENUM ('INQUIRY_DEPOSIT_PENDING', 'DB_MARKETPLACE_PURCHASE');

CREATE TABLE "tenant_coin_ledger_entries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "period_ym" VARCHAR(7) NOT NULL,
    "source_type" "TenantCoinLedgerSourceType" NOT NULL,
    "source_id" VARCHAR(64) NOT NULL,
    "amount" INTEGER NOT NULL DEFAULT 1,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_coin_ledger_entries_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_coin_ledger_entries_tenant_id_source_type_source_id_key" ON "tenant_coin_ledger_entries"("tenant_id", "source_type", "source_id");

CREATE INDEX "tenant_coin_ledger_entries_tenant_id_period_ym_idx" ON "tenant_coin_ledger_entries"("tenant_id", "period_ym");

ALTER TABLE "tenant_coin_ledger_entries" ADD CONSTRAINT "tenant_coin_ledger_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
