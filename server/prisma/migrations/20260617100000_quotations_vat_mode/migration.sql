-- CreateEnum
CREATE TYPE "QuotationVatMode" AS ENUM ('TAX_FREE', 'VAT_SEPARATE');

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN "vat_mode" "QuotationVatMode" NOT NULL DEFAULT 'VAT_SEPARATE';
