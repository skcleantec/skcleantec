-- 팀장 잔금 확인·회사 입금 대기
ALTER TABLE "bank_deposits" ADD COLUMN IF NOT EXISTS "mismatch_reason" VARCHAR(32);
ALTER TABLE "bank_deposits" ADD COLUMN IF NOT EXISTS "team_reminded_at" TIMESTAMP(3);
ALTER TABLE "bank_deposits" ADD COLUMN IF NOT EXISTS "open_reminder_stopped_at" TIMESTAMP(3);
ALTER TABLE "bank_deposits" ADD COLUMN IF NOT EXISTS "no_owner_notified_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "bank_deposits_tenant_id_status_open_reminder_stopped_at_idx"
  ON "bank_deposits"("tenant_id", "status", "open_reminder_stopped_at");

CREATE TABLE IF NOT EXISTS "bank_deposit_team_responses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "deposit_id" TEXT NOT NULL,
    "team_leader_id" TEXT NOT NULL,
    "response" VARCHAR(16) NOT NULL DEFAULT 'DECLINED',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_deposit_team_responses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bank_deposit_team_responses_deposit_id_team_leader_id_key"
  ON "bank_deposit_team_responses"("deposit_id", "team_leader_id");
CREATE INDEX IF NOT EXISTS "bank_deposit_team_responses_tenant_id_deposit_id_idx"
  ON "bank_deposit_team_responses"("tenant_id", "deposit_id");

CREATE TABLE IF NOT EXISTS "bank_deposit_balance_notices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "deposit_id" TEXT NOT NULL,
    "team_leader_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_deposit_balance_notices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bank_deposit_balance_notices_deposit_id_team_leader_id_key"
  ON "bank_deposit_balance_notices"("deposit_id", "team_leader_id");
CREATE INDEX IF NOT EXISTS "bank_deposit_balance_notices_tenant_id_deposit_id_idx"
  ON "bank_deposit_balance_notices"("tenant_id", "deposit_id");

CREATE TABLE IF NOT EXISTS "bank_deposit_expectations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "team_leader_id" TEXT NOT NULL,
    "depositor_name" VARCHAR(80) NOT NULL,
    "amount_won" INTEGER NOT NULL,
    "status" VARCHAR(16) NOT NULL,
    "waiting_key" TEXT,
    "matched_deposit_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matched_at" TIMESTAMP(3),
    CONSTRAINT "bank_deposit_expectations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bank_deposit_expectations_tenant_id_waiting_key_key"
  ON "bank_deposit_expectations"("tenant_id", "waiting_key");
CREATE INDEX IF NOT EXISTS "bank_deposit_expectations_tenant_id_inquiry_id_status_idx"
  ON "bank_deposit_expectations"("tenant_id", "inquiry_id", "status");
CREATE INDEX IF NOT EXISTS "bank_deposit_expectations_tenant_id_status_idx"
  ON "bank_deposit_expectations"("tenant_id", "status");

DO $$ BEGIN
  ALTER TABLE "bank_deposit_team_responses" ADD CONSTRAINT "bank_deposit_team_responses_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "bank_deposit_team_responses" ADD CONSTRAINT "bank_deposit_team_responses_deposit_id_fkey"
    FOREIGN KEY ("deposit_id") REFERENCES "bank_deposits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "bank_deposit_team_responses" ADD CONSTRAINT "bank_deposit_team_responses_team_leader_id_fkey"
    FOREIGN KEY ("team_leader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bank_deposit_balance_notices" ADD CONSTRAINT "bank_deposit_balance_notices_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "bank_deposit_balance_notices" ADD CONSTRAINT "bank_deposit_balance_notices_deposit_id_fkey"
    FOREIGN KEY ("deposit_id") REFERENCES "bank_deposits"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "bank_deposit_balance_notices" ADD CONSTRAINT "bank_deposit_balance_notices_team_leader_id_fkey"
    FOREIGN KEY ("team_leader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bank_deposit_expectations" ADD CONSTRAINT "bank_deposit_expectations_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "bank_deposit_expectations" ADD CONSTRAINT "bank_deposit_expectations_inquiry_id_fkey"
    FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "bank_deposit_expectations" ADD CONSTRAINT "bank_deposit_expectations_team_leader_id_fkey"
    FOREIGN KEY ("team_leader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "bank_deposit_expectations" ADD CONSTRAINT "bank_deposit_expectations_matched_deposit_id_fkey"
    FOREIGN KEY ("matched_deposit_id") REFERENCES "bank_deposits"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
