-- 입금 문자 중복 지문·해석 실패·다시 훑기
ALTER TABLE "bank_deposits" ADD COLUMN IF NOT EXISTS "content_hash" VARCHAR(64);
ALTER TABLE "bank_deposits" ADD COLUMN IF NOT EXISTS "source" VARCHAR(16) NOT NULL DEFAULT 'sms';
ALTER TABLE "bank_deposits" ADD COLUMN IF NOT EXISTS "fingerprint" VARCHAR(200);

-- deposited_at 은 UTC 시각이 타임존 없이 저장된다. 한국 시간 분으로 맞춘다.
UPDATE "bank_deposits"
SET "fingerprint" = "account_mask" || '|' || "amount_won"::text || '|' || btrim("depositor_name") || '|' ||
  to_char(("deposited_at" AT TIME ZONE 'UTC') AT TIME ZONE 'Asia/Seoul', 'YYYY-MM-DD HH24:MI')
WHERE "fingerprint" IS NULL;

ALTER TABLE "bank_deposits" ALTER COLUMN "fingerprint" SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "bank_deposits_tenant_id_content_hash_key"
  ON "bank_deposits"("tenant_id", "content_hash");
CREATE INDEX IF NOT EXISTS "bank_deposits_tenant_id_fingerprint_idx"
  ON "bank_deposits"("tenant_id", "fingerprint");

ALTER TABLE "bank_deposit_devices" ADD COLUMN IF NOT EXISTS "rescan_requested_at" TIMESTAMP(3);
ALTER TABLE "bank_deposit_devices" ADD COLUMN IF NOT EXISTS "last_scan_at" TIMESTAMP(3);
ALTER TABLE "bank_deposit_devices" ADD COLUMN IF NOT EXISTS "last_scan_found" INTEGER;

CREATE TABLE IF NOT EXISTS "bank_deposit_unparsed" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "device_id" TEXT,
    "dedupe_key" VARCHAR(128) NOT NULL,
    "text" TEXT,
    "reason" VARCHAR(32) NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL,
    "resolved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "bank_deposit_unparsed_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "bank_deposit_unparsed_tenant_id_dedupe_key_key"
  ON "bank_deposit_unparsed"("tenant_id", "dedupe_key");
CREATE INDEX IF NOT EXISTS "bank_deposit_unparsed_tenant_id_resolved_at_received_at_idx"
  ON "bank_deposit_unparsed"("tenant_id", "resolved_at", "received_at");

DO $$ BEGIN
  ALTER TABLE "bank_deposit_unparsed" ADD CONSTRAINT "bank_deposit_unparsed_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "bank_deposit_unparsed" ADD CONSTRAINT "bank_deposit_unparsed_device_id_fkey"
    FOREIGN KEY ("device_id") REFERENCES "bank_deposit_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
