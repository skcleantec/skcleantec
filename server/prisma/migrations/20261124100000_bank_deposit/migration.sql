-- 사업자폰 입금 알림. 잔액 컬럼은 없다.
CREATE TABLE IF NOT EXISTS "bank_deposit_devices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "token_hash" VARCHAR(64) NOT NULL,
    "last_seen_at" TIMESTAMP(3),
    "app_version" VARCHAR(40),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "revoked_at" TIMESTAMP(3),
    CONSTRAINT "bank_deposit_devices_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bank_deposit_devices_token_hash_key" ON "bank_deposit_devices"("token_hash");
CREATE INDEX IF NOT EXISTS "bank_deposit_devices_tenant_id_is_active_idx" ON "bank_deposit_devices"("tenant_id", "is_active");

CREATE TABLE IF NOT EXISTS "bank_deposit_accounts" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "bank_name" VARCHAR(32) NOT NULL,
    "account_mask" VARCHAR(40) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bank_deposit_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bank_deposit_accounts_tenant_id_is_active_idx" ON "bank_deposit_accounts"("tenant_id", "is_active");

CREATE TABLE IF NOT EXISTS "bank_deposit_link_codes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code_hash" VARCHAR(64) NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "created_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_deposit_link_codes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "bank_deposit_link_codes_code_hash_expires_at_idx" ON "bank_deposit_link_codes"("code_hash", "expires_at");
CREATE INDEX IF NOT EXISTS "bank_deposit_link_codes_tenant_id_created_at_idx" ON "bank_deposit_link_codes"("tenant_id", "created_at");

CREATE TABLE IF NOT EXISTS "bank_deposits" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "operating_company_id" TEXT,
    "device_id" TEXT,
    "dedupe_key" VARCHAR(128) NOT NULL,
    "bank_name" VARCHAR(32) NOT NULL,
    "amount_won" INTEGER NOT NULL,
    "depositor_name" VARCHAR(80) NOT NULL,
    "account_mask" VARCHAR(40) NOT NULL,
    "deposited_at" TIMESTAMP(3) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "raw_text" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "linked_inquiry_id" TEXT,
    "linked_followup_id" TEXT,
    "linked_kind" VARCHAR(16),
    "linked_by_user_id" TEXT,
    "linked_at" TIMESTAMP(3),
    "note" VARCHAR(200),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "bank_deposits_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bank_deposits_tenant_id_dedupe_key_key" ON "bank_deposits"("tenant_id", "dedupe_key");
CREATE INDEX IF NOT EXISTS "bank_deposits_tenant_id_deposited_at_idx" ON "bank_deposits"("tenant_id", "deposited_at" DESC);
CREATE INDEX IF NOT EXISTS "bank_deposits_tenant_id_status_deposited_at_idx" ON "bank_deposits"("tenant_id", "status", "deposited_at" DESC);
CREATE INDEX IF NOT EXISTS "bank_deposits_linked_inquiry_id_idx" ON "bank_deposits"("linked_inquiry_id");

DO $$ BEGIN
  ALTER TABLE "bank_deposit_devices" ADD CONSTRAINT "bank_deposit_devices_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bank_deposit_accounts" ADD CONSTRAINT "bank_deposit_accounts_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bank_deposit_accounts" ADD CONSTRAINT "bank_deposit_accounts_operating_company_id_fkey"
    FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bank_deposit_link_codes" ADD CONSTRAINT "bank_deposit_link_codes_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bank_deposit_link_codes" ADD CONSTRAINT "bank_deposit_link_codes_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bank_deposits" ADD CONSTRAINT "bank_deposits_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bank_deposits" ADD CONSTRAINT "bank_deposits_operating_company_id_fkey"
    FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bank_deposits" ADD CONSTRAINT "bank_deposits_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "bank_deposit_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bank_deposits" ADD CONSTRAINT "bank_deposits_linked_inquiry_id_fkey"
    FOREIGN KEY ("linked_inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bank_deposits" ADD CONSTRAINT "bank_deposits_linked_followup_id_fkey"
    FOREIGN KEY ("linked_followup_id") REFERENCES "order_followups"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "bank_deposits" ADD CONSTRAINT "bank_deposits_linked_by_user_id_fkey"
    FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
