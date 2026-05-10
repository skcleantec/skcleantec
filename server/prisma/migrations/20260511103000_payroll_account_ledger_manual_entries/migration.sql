-- CreateEnum
CREATE TYPE "PayrollAccountLedgerManualDirection" AS ENUM ('IN', 'OUT');

-- CreateTable
CREATE TABLE "payroll_account_ledger_manual_entries" (
    "id" TEXT NOT NULL,
    "month_key" VARCHAR(7) NOT NULL,
    "direction" "PayrollAccountLedgerManualDirection" NOT NULL,
    "occurred_on" DATE NOT NULL,
    "account_label" VARCHAR(128) NOT NULL,
    "amount" INTEGER NOT NULL,
    "memo" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_account_ledger_manual_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "payroll_account_ledger_manual_entries_month_key_occurred_on_created_at_idx" ON "payroll_account_ledger_manual_entries"("month_key", "occurred_on" ASC, "created_at" ASC);

-- AddForeignKey
ALTER TABLE "payroll_account_ledger_manual_entries" ADD CONSTRAINT "payroll_account_ledger_manual_entries_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
