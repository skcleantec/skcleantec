-- 입금 확인 알림 수신 이메일 — 단일 컬럼 → JSONB 배열
ALTER TABLE "platform_billing_settings"
ADD COLUMN "dunning_payment_notify_emails" JSONB NOT NULL DEFAULT '[]';

UPDATE "platform_billing_settings"
SET "dunning_payment_notify_emails" = jsonb_build_array(trim("dunning_payment_notify_email"))
WHERE "dunning_payment_notify_email" IS NOT NULL
  AND trim("dunning_payment_notify_email") <> '';
