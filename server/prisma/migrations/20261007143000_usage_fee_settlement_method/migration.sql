-- 이용료 정산: 통장 입금과 카드 승인을 구분하고, 카드 금액은 부가세를 포함한다.
DO $$ BEGIN
  CREATE TYPE "UsageFeePayMethod" AS ENUM ('BANK', 'KEYIN', 'PAY_WINDOW');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "UsageFeeCardPaymentStatus" AS ENUM ('PENDING', 'APPROVED', 'FAILED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "pay_method" "UsageFeePayMethod" NOT NULL DEFAULT 'KEYIN';
ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "status" "UsageFeeCardPaymentStatus" NOT NULL DEFAULT 'APPROVED';
ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "supply_amount_krw" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "vat_amount_krw" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "pg_mid" VARCHAR(20);
ALTER TABLE "usage_fee_card_payments" ADD COLUMN IF NOT EXISTS "pay_screen" VARCHAR(2);

UPDATE "usage_fee_card_payments"
SET "supply_amount_krw" = "amount_krw"
WHERE "supply_amount_krw" = 0 AND "amount_krw" > 0;

ALTER TABLE "usage_fee_card_payments" ALTER COLUMN "pg_order_id" DROP NOT NULL;
ALTER TABLE "usage_fee_card_payments" ALTER COLUMN "card_last4" DROP NOT NULL;
ALTER TABLE "usage_fee_card_payments" ALTER COLUMN "buyer_name" DROP NOT NULL;

CREATE INDEX IF NOT EXISTS "usage_fee_card_payments_status_paid_at_idx" ON "usage_fee_card_payments"("status", "paid_at");
