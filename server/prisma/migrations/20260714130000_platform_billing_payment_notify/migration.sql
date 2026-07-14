-- 입금 확인 요청 알림 이메일 + 청구서별 요청 시각 (중복 방지)
ALTER TABLE "platform_billing_settings"
  ADD COLUMN IF NOT EXISTS "dunning_payment_notify_email" VARCHAR(256);

ALTER TABLE "tenant_invoices"
  ADD COLUMN IF NOT EXISTS "payment_confirmation_requested_at" TIMESTAMP(3);
