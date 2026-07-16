-- CreateEnum
CREATE TYPE "QuotationDocumentType" AS ENUM ('QUOTATION', 'RECEIPT');

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN "document_type" "QuotationDocumentType" NOT NULL DEFAULT 'QUOTATION';

-- AlterTable
ALTER TABLE "quotation_config" ADD COLUMN "receipt_footer_notice" TEXT;

-- CreateTable
CREATE TABLE "quotation_receipt_daily_counters" (
    "tenant_id" TEXT NOT NULL,
    "date_key" CHAR(8) NOT NULL,
    "last_seq" INTEGER NOT NULL,

    CONSTRAINT "quotation_receipt_daily_counters_pkey" PRIMARY KEY ("tenant_id","date_key")
);

-- AddForeignKey
ALTER TABLE "quotation_receipt_daily_counters" ADD CONSTRAINT "quotation_receipt_daily_counters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
