-- 견적 공급받는자: 손님(기본) / 타업체. 기존 행은 손님.
DO $$ BEGIN
  CREATE TYPE "QuotationRecipientKind" AS ENUM ('CUSTOMER', 'PARTNER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "recipient_kind" "QuotationRecipientKind" NOT NULL DEFAULT 'CUSTOMER';
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "customer_biz_no" VARCHAR(20);
ALTER TABLE "quotations" ADD COLUMN IF NOT EXISTS "customer_rep_name" VARCHAR(80);
