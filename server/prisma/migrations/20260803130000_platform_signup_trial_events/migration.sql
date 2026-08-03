-- 플랫폼 가입 체험 이벤트
CREATE TABLE IF NOT EXISTS "platform_signup_trial_events" (
    "id" TEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "trial_days" INTEGER NOT NULL DEFAULT 60,
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "apply_self_serve" BOOLEAN NOT NULL DEFAULT true,
    "apply_platform_provision" BOOLEAN NOT NULL DEFAULT true,
    "include_coin_grace" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_platform_user_id" VARCHAR(64),

    CONSTRAINT "platform_signup_trial_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "platform_signup_trial_events_is_active_priority_created_at_idx"
ON "platform_signup_trial_events"("is_active", "priority", "created_at");

-- 기존 유료 셀프가입 자동 체험과 동일하게, 기본 이벤트 1건을 ON으로 시드
INSERT INTO "platform_signup_trial_events" (
  "id", "name", "is_active", "trial_days", "starts_at", "ends_at",
  "apply_self_serve", "apply_platform_provision", "include_coin_grace",
  "priority", "created_at", "updated_at"
)
SELECT
  'default-signup-trial-60d',
  '기본 가입 체험 60일',
  true,
  60,
  NULL,
  NULL,
  true,
  true,
  true,
  100,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "platform_signup_trial_events" WHERE "id" = 'default-signup-trial-60d'
);
