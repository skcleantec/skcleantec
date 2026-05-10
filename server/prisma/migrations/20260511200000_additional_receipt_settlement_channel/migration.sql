-- CreateEnum
CREATE TYPE "AdditionalReceiptSettlementChannel" AS ENUM ('COMPANY_DEPOSIT', 'FIELD_RECEIVED');

-- AlterTable
ALTER TABLE "inquiry_additional_receipts" ADD COLUMN "settlement_channel" "AdditionalReceiptSettlementChannel" NOT NULL DEFAULT 'COMPANY_DEPOSIT';
