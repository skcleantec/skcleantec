-- 서비스브릿지 수기 이용료 승인 기록. 카드번호는 저장하지 않는다.
DO $$ BEGIN
  CREATE TYPE "UsageFeeCardPaymentPurpose" AS ENUM ('INVOICE', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "usage_fee_card_payments" (
  "id" TEXT NOT NULL,
  "purpose" "UsageFeeCardPaymentPurpose" NOT NULL,
  "tenant_id" TEXT,
  "invoice_id" TEXT,
  "period_start" TIMESTAMP(3),
  "goods_name" VARCHAR(80) NOT NULL,
  "amount_krw" INTEGER NOT NULL,
  "approval_no" VARCHAR(32),
  "pg_order_id" VARCHAR(40) NOT NULL,
  "card_last4" VARCHAR(4) NOT NULL,
  "buyer_name" VARCHAR(40) NOT NULL,
  "memo" TEXT,
  "invoice_applied" BOOLEAN NOT NULL DEFAULT false,
  "paid_at" TIMESTAMP(3) NOT NULL,
  "created_by_platform_user_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usage_fee_card_payments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "usage_fee_card_payments_pg_order_id_key" ON "usage_fee_card_payments"("pg_order_id");
CREATE INDEX IF NOT EXISTS "usage_fee_card_payments_tenant_id_paid_at_idx" ON "usage_fee_card_payments"("tenant_id", "paid_at");
CREATE INDEX IF NOT EXISTS "usage_fee_card_payments_paid_at_idx" ON "usage_fee_card_payments"("paid_at");

DO $$ BEGIN
  ALTER TABLE "usage_fee_card_payments"
    ADD CONSTRAINT "usage_fee_card_payments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "usage_fee_card_payments"
    ADD CONSTRAINT "usage_fee_card_payments_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "tenant_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "usage_fee_card_payments"
    ADD CONSTRAINT "usage_fee_card_payments_created_by_platform_user_id_fkey"
    FOREIGN KEY ("created_by_platform_user_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
