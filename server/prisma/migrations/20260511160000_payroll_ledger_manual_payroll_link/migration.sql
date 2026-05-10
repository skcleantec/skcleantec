-- PayrollLedgerManualPayrollLinkKind — idempotent (재적용·부분 실패 복구용)
DO $$ BEGIN
  CREATE TYPE "PayrollLedgerManualPayrollLinkKind" AS ENUM ('NONE', 'POOL_MEMBER', 'TEAM_LEADER', 'MARKETER', 'EXTERNAL_COMPANY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "payroll_account_ledger_manual_entries" ADD COLUMN IF NOT EXISTS "payroll_link_kind" "PayrollLedgerManualPayrollLinkKind" NOT NULL DEFAULT 'NONE';
ALTER TABLE "payroll_account_ledger_manual_entries" ADD COLUMN IF NOT EXISTS "link_team_member_id" TEXT;
ALTER TABLE "payroll_account_ledger_manual_entries" ADD COLUMN IF NOT EXISTS "link_user_id" TEXT;
ALTER TABLE "payroll_account_ledger_manual_entries" ADD COLUMN IF NOT EXISTS "link_external_company_id" TEXT;

-- 긴 이름은 PG에서 잘리며 서로 충돌할 수 있음 — 구버전·실패 잔여 인덱스 정리
DROP INDEX IF EXISTS "payroll_account_ledger_manual_entries_month_key_payroll_link_kind_link_team_member_id_idx";
DROP INDEX IF EXISTS "payroll_account_ledger_manual_entries_month_key_payroll_link_kind_link_user_id_idx";
DROP INDEX IF EXISTS "payroll_account_ledger_manual_entries_month_key_payroll_lin_idx";

CREATE INDEX IF NOT EXISTS "pld_manual_month_pool_idx" ON "payroll_account_ledger_manual_entries"("month_key", "payroll_link_kind", "link_team_member_id");
CREATE INDEX IF NOT EXISTS "pld_manual_month_user_idx" ON "payroll_account_ledger_manual_entries"("month_key", "payroll_link_kind", "link_user_id");

DO $$ BEGIN
  ALTER TABLE "payroll_account_ledger_manual_entries" ADD CONSTRAINT "payroll_account_ledger_manual_entries_link_team_member_id_fkey" FOREIGN KEY ("link_team_member_id") REFERENCES "team_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "payroll_account_ledger_manual_entries" ADD CONSTRAINT "payroll_account_ledger_manual_entries_link_user_id_fkey" FOREIGN KEY ("link_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "payroll_account_ledger_manual_entries" ADD CONSTRAINT "payroll_account_ledger_manual_entries_link_external_company_id_fkey" FOREIGN KEY ("link_external_company_id") REFERENCES "external_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
