-- 카드 승인 부가정보와 업체 취소 요청. 기존 행은 비워 둔다.
ALTER TABLE "card_payments" ADD COLUMN IF NOT EXISTS "installment_months" INTEGER;
ALTER TABLE "card_payments" ADD COLUMN IF NOT EXISTS "card_issuer" VARCHAR(40);
ALTER TABLE "card_payments" ADD COLUMN IF NOT EXISTS "card_kind" VARCHAR(16);
ALTER TABLE "card_payments" ADD COLUMN IF NOT EXISTS "paid_source" VARCHAR(16);

ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "installment_months" INTEGER;
ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "card_issuer" VARCHAR(40);
ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "card_kind" VARCHAR(16);
ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "paid_source" VARCHAR(16);

CREATE TABLE IF NOT EXISTS "card_payment_cancel_requests" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "card_payment_id" TEXT NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "requested_by_id" TEXT NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  "notify_tenant" BOOLEAN NOT NULL DEFAULT true,
  "decision_note" VARCHAR(500),
  "decided_by_platform_user_id" TEXT,
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "decided_at" TIMESTAMP(3),
  CONSTRAINT "card_payment_cancel_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "card_payment_cancel_requests_tenant_id_status_idx" ON "card_payment_cancel_requests"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "card_payment_cancel_requests_card_payment_id_requested_at_idx" ON "card_payment_cancel_requests"("card_payment_id", "requested_at");

DO $$ BEGIN
  ALTER TABLE "card_payment_cancel_requests" ADD CONSTRAINT "card_payment_cancel_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "card_payment_cancel_requests" ADD CONSTRAINT "card_payment_cancel_requests_card_payment_id_fkey" FOREIGN KEY ("card_payment_id") REFERENCES "card_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "card_payment_cancel_requests" ADD CONSTRAINT "card_payment_cancel_requests_requested_by_id_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "card_payment_cancel_requests" ADD CONSTRAINT "card_payment_cancel_requests_decided_by_platform_user_id_fkey" FOREIGN KEY ("decided_by_platform_user_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
