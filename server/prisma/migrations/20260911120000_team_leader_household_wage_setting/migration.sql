-- CreateEnum
CREATE TYPE "TeamLeaderHouseholdWageMode" AS ENUM ('BALANCE_PCT', 'DAILY', 'MONTHLY');

-- AlterTable
ALTER TABLE "team_leader_household_ledger_entries" ADD COLUMN "amount_locked" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "team_leader_household_wage_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "team_leader_id" TEXT NOT NULL,
    "wage_mode" "TeamLeaderHouseholdWageMode" NOT NULL DEFAULT 'BALANCE_PCT',
    "balance_share_percent" INTEGER NOT NULL DEFAULT 100,
    "daily_amount_won" INTEGER,
    "monthly_amount_won" INTEGER,
    "suppressed_wage_keys" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_leader_household_wage_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tl_household_wage_setting_tenant_leader_uidx" ON "team_leader_household_wage_settings"("tenant_id", "team_leader_id");

-- AddForeignKey
ALTER TABLE "team_leader_household_wage_settings" ADD CONSTRAINT "team_leader_household_wage_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "team_leader_household_wage_settings" ADD CONSTRAINT "team_leader_household_wage_settings_team_leader_id_fkey" FOREIGN KEY ("team_leader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
