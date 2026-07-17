-- TelecrmCallSession — 연결 통화 분류(90초) · CallLog 동기화 필드
ALTER TABLE "telecrm_call_sessions" ADD COLUMN "status" VARCHAR(20) NOT NULL DEFAULT 'DIAL_ATTEMPT';
ALTER TABLE "telecrm_call_sessions" ADD COLUMN "connected_min_sec" INTEGER NOT NULL DEFAULT 90;
ALTER TABLE "telecrm_call_sessions" ADD COLUMN "verified_at" TIMESTAMP(3);
ALTER TABLE "telecrm_call_sessions" ADD COLUMN "source" VARCHAR(20);

-- 기존 duration 기록 → 90초 기준 소급 분류
UPDATE "telecrm_call_sessions"
SET "status" = CASE
  WHEN "duration_sec" IS NOT NULL AND "duration_sec" >= 90 THEN 'CONNECTED'
  WHEN "duration_sec" IS NOT NULL AND "duration_sec" > 0 THEN 'NO_ANSWER'
  WHEN "android_call_log_id" IS NOT NULL THEN 'NO_ANSWER'
  ELSE 'DIAL_ATTEMPT'
END,
"verified_at" = CASE
  WHEN "android_call_log_id" IS NOT NULL OR ("duration_sec" IS NOT NULL AND "duration_sec" > 0)
  THEN COALESCE("started_at", "created_at")
  ELSE NULL
END,
"source" = CASE
  WHEN "android_call_log_id" IS NOT NULL THEN 'CALLLOG_SYNC'
  ELSE 'APP_DIAL'
END
WHERE "status" = 'DIAL_ATTEMPT';

CREATE INDEX "telecrm_call_sessions_tenant_id_user_id_started_at_idx"
  ON "telecrm_call_sessions"("tenant_id", "user_id", "started_at" DESC);

CREATE INDEX "telecrm_call_sessions_tenant_id_status_started_at_idx"
  ON "telecrm_call_sessions"("tenant_id", "status", "started_at" DESC);
