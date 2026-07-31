-- 일정 긴급 알림(사이렌) — 사용자별 건별 확인
ALTER TABLE "inquiry_change_logs" ADD COLUMN IF NOT EXISTS "schedule_alert_kind" TEXT;

CREATE INDEX IF NOT EXISTS "inquiry_change_logs_schedule_alert_kind_created_at_idx"
  ON "inquiry_change_logs" ("schedule_alert_kind", "created_at" DESC);

CREATE TABLE IF NOT EXISTS "inquiry_schedule_alert_acks" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "change_log_id" TEXT NOT NULL,
  "acknowledged_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inquiry_schedule_alert_acks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "inquiry_schedule_alert_acks_user_id_change_log_id_key"
  ON "inquiry_schedule_alert_acks" ("user_id", "change_log_id");

CREATE INDEX IF NOT EXISTS "inquiry_schedule_alert_acks_tenant_id_user_id_idx"
  ON "inquiry_schedule_alert_acks" ("tenant_id", "user_id");

CREATE INDEX IF NOT EXISTS "inquiry_schedule_alert_acks_change_log_id_idx"
  ON "inquiry_schedule_alert_acks" ("change_log_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inquiry_schedule_alert_acks_tenant_id_fkey'
  ) THEN
    ALTER TABLE "inquiry_schedule_alert_acks"
      ADD CONSTRAINT "inquiry_schedule_alert_acks_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inquiry_schedule_alert_acks_user_id_fkey'
  ) THEN
    ALTER TABLE "inquiry_schedule_alert_acks"
      ADD CONSTRAINT "inquiry_schedule_alert_acks_user_id_fkey"
      FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'inquiry_schedule_alert_acks_change_log_id_fkey'
  ) THEN
    ALTER TABLE "inquiry_schedule_alert_acks"
      ADD CONSTRAINT "inquiry_schedule_alert_acks_change_log_id_fkey"
      FOREIGN KEY ("change_log_id") REFERENCES "inquiry_change_logs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
