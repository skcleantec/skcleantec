-- CreateEnum
CREATE TYPE "TeamLeaderHouseholdLedgerDirection" AS ENUM ('INCOME', 'EXPENSE');

-- CreateTable
CREATE TABLE "team_leader_household_ledger_entries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "team_leader_id" TEXT NOT NULL,
    "direction" "TeamLeaderHouseholdLedgerDirection" NOT NULL,
    "occurred_on" DATE NOT NULL,
    "category" VARCHAR(64) NOT NULL,
    "amount" INTEGER NOT NULL,
    "memo" TEXT,
    "inquiry_id" TEXT,
    "prefill_kind" VARCHAR(32),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_leader_household_ledger_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tl_household_ledger_tenant_leader_occurred_idx" ON "team_leader_household_ledger_entries"("tenant_id", "team_leader_id", "occurred_on" DESC);

-- CreateIndex
CREATE INDEX "tl_household_ledger_tenant_leader_inquiry_idx" ON "team_leader_household_ledger_entries"("tenant_id", "team_leader_id", "inquiry_id");

-- AddForeignKey
ALTER TABLE "team_leader_household_ledger_entries" ADD CONSTRAINT "team_leader_household_ledger_entries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_leader_household_ledger_entries" ADD CONSTRAINT "team_leader_household_ledger_entries_team_leader_id_fkey" FOREIGN KEY ("team_leader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_leader_household_ledger_entries" ADD CONSTRAINT "team_leader_household_ledger_entries_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
