-- 플랫폼 결제 링크. 기존 이용료 결제 기록에 용도·토큰만 더한다.
ALTER TYPE "UsageFeeCardPaymentPurpose" ADD VALUE IF NOT EXISTS 'CLEANING_PROXY';

ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "buyer_phone" VARCHAR(32);
ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "inquiry_id" TEXT;
ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "link_token" VARCHAR(16);
ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "link_expires_at" TIMESTAMP(3);
ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "link_closed_at" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "usage_fee_card_payments_link_token_key" ON "usage_fee_card_payments"("link_token");
