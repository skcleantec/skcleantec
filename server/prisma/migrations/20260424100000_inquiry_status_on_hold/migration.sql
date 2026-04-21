-- AlterEnum: 접수 보류(일정 미확정)
ALTER TYPE "InquiryStatus" ADD VALUE IF NOT EXISTS 'ON_HOLD';

-- 취소 후에도 타업체 수수료 역분개를 위해 취소 시점 업체 id 보관
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "cancel_fee_external_company_id" UUID;
DO $$
BEGIN
  ALTER TABLE "inquiries"
    ADD CONSTRAINT "inquiries_cancel_fee_external_company_id_fkey"
    FOREIGN KEY ("cancel_fee_external_company_id") REFERENCES "external_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
