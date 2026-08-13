-- 플랫폼 시스템 SMTP From 기본값: cbiseo@service-bridges.com
UPDATE "platform_billing_settings"
SET "smtp_from" = 'cbiseo@service-bridges.com'
WHERE "id" = 'default'
  AND (
    "smtp_from" IS NULL
    OR TRIM("smtp_from") = ''
  );
