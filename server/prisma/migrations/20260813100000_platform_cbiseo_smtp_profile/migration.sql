-- Seed platform-cbiseo SMTP profile (입금 확인·플랫폼 시스템 알림)
INSERT INTO "platform_smtp_profiles" (
    "id",
    "slug",
    "label",
    "enabled",
    "purposes",
    "smtp_host",
    "smtp_port",
    "smtp_secure",
    "smtp_from",
    "default_display_name",
    "sort_order",
    "updated_at"
)
SELECT
    gen_random_uuid()::text,
    'platform-cbiseo',
    '플랫폼 알림 (cbiseo)',
    true,
    '["PLATFORM_SYSTEM_NOTIFY"]'::jsonb,
    'smtp.gmail.com',
    587,
    false,
    'cbiseo@service-bridges.com',
    '청소비서',
    1,
    CURRENT_TIMESTAMP
WHERE NOT EXISTS (
    SELECT 1 FROM "platform_smtp_profiles" WHERE "slug" = 'platform-cbiseo'
);

-- 레거시 platform_billing_settings SMTP → platform-cbiseo 프로필로 이전 (비밀번호 없을 때만)
UPDATE "platform_smtp_profiles" AS p
SET
    "smtp_host" = COALESCE(NULLIF(trim(p."smtp_host"), ''), b."smtp_host"),
    "smtp_port" = COALESCE(p."smtp_port", b."smtp_port"),
    "smtp_secure" = COALESCE(p."smtp_secure", b."smtp_secure"),
    "smtp_user" = COALESCE(NULLIF(trim(p."smtp_user"), ''), b."smtp_user"),
    "smtp_pass_enc" = COALESCE(NULLIF(trim(p."smtp_pass_enc"), ''), b."smtp_pass_enc"),
    "smtp_from" = CASE
        WHEN trim(COALESCE(p."smtp_from", '')) = '' OR p."smtp_from" NOT LIKE '%@%'
        THEN COALESCE(
            NULLIF(trim(b."smtp_from"), ''),
            'cbiseo@service-bridges.com'
        )
        ELSE p."smtp_from"
    END,
    "updated_at" = CURRENT_TIMESTAMP
FROM "platform_billing_settings" AS b
WHERE p."slug" = 'platform-cbiseo'
  AND b."id" = 'default'
  AND (p."smtp_pass_enc" IS NULL OR trim(p."smtp_pass_enc") = '')
  AND b."smtp_pass_enc" IS NOT NULL
  AND trim(b."smtp_pass_enc") <> '';
