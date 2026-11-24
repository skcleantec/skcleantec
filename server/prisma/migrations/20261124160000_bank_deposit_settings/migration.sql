-- 입금 알림 설정, 직접 추가한 사람, 지운 입금 30일
ALTER TABLE "bank_deposits" ADD COLUMN IF NOT EXISTS "created_by_user_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "bank_deposits" ADD CONSTRAINT "bank_deposits_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "bank_deposit_settings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "team_open_alert_enabled" BOOLEAN NOT NULL DEFAULT true,
    "team_balance_alert_enabled" BOOLEAN NOT NULL DEFAULT true,
    "team_alert_min_amount_won" INTEGER NOT NULL DEFAULT 50000,
    "team_reminder_interval_min" INTEGER NOT NULL DEFAULT 10,
    "team_alert_start_hour" INTEGER NOT NULL DEFAULT 8,
    "team_alert_end_hour" INTEGER NOT NULL DEFAULT 21,
    "team_reminder_max_hours" INTEGER NOT NULL DEFAULT 48,
    "deposit_amounts_mode" VARCHAR(16) NOT NULL DEFAULT 'auto',
    "deposit_amounts_won" JSONB NOT NULL DEFAULT '[]',
    "staff_toast_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_deposit_settings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bank_deposit_settings_tenant_id_key" ON "bank_deposit_settings"("tenant_id");

DO $$ BEGIN
  ALTER TABLE "bank_deposit_settings" ADD CONSTRAINT "bank_deposit_settings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "bank_deposit_tombstones" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "dedupe_key" VARCHAR(128),
    "content_hash" VARCHAR(64),
    "fingerprint" VARCHAR(200),
    "deleted_by_user_id" TEXT NOT NULL,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bank_deposit_tombstones_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bank_deposit_tombstones_tenant_id_expires_at_idx"
  ON "bank_deposit_tombstones"("tenant_id", "expires_at");
CREATE INDEX IF NOT EXISTS "bank_deposit_tombstones_tenant_id_dedupe_key_idx"
  ON "bank_deposit_tombstones"("tenant_id", "dedupe_key");
CREATE INDEX IF NOT EXISTS "bank_deposit_tombstones_tenant_id_content_hash_idx"
  ON "bank_deposit_tombstones"("tenant_id", "content_hash");
CREATE INDEX IF NOT EXISTS "bank_deposit_tombstones_tenant_id_fingerprint_idx"
  ON "bank_deposit_tombstones"("tenant_id", "fingerprint");

DO $$ BEGIN
  ALTER TABLE "bank_deposit_tombstones" ADD CONSTRAINT "bank_deposit_tombstones_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "bank_deposit_tombstones" ADD CONSTRAINT "bank_deposit_tombstones_deleted_by_user_id_fkey"
    FOREIGN KEY ("deleted_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
