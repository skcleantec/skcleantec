-- 기본 입금 확인 알림 그룹: billing@service-bridges.com
UPDATE "platform_billing_settings"
SET "dunning_payment_notify_email" = 'billing@service-bridges.com'
WHERE "id" = 'default'
  AND (
    "dunning_payment_notify_email" IS NULL
    OR TRIM("dunning_payment_notify_email") = ''
  );
