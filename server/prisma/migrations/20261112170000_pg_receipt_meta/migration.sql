ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "pg_response_meta" JSONB;
ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "pg_tid" VARCHAR(40);
ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "pg_receipt_url" VARCHAR(500);

ALTER TABLE "card_payments" ADD COLUMN IF NOT EXISTS "pg_response_meta" JSONB;
ALTER TABLE "card_payments" ADD COLUMN IF NOT EXISTS "pg_tid" VARCHAR(40);
ALTER TABLE "card_payments" ADD COLUMN IF NOT EXISTS "pg_receipt_url" VARCHAR(500);
