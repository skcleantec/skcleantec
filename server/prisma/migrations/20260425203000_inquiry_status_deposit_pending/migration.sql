-- AlterEnum: InquiryStatus + DEPOSIT_PENDING
DO $$
BEGIN
  ALTER TYPE "InquiryStatus" ADD VALUE 'DEPOSIT_PENDING';
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
