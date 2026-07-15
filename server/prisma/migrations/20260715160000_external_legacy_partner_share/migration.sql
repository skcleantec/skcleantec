-- CreateEnum
CREATE TYPE "TenantInquiryShareSettlementMode" AS ENUM ('PARTNER_NATIVE', 'EXTERNAL_LEGACY');

-- AlterTable
ALTER TABLE "external_companies" ADD COLUMN "linked_partner_tenant_id" TEXT,
ADD COLUMN "promoted_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "tenant_inquiry_shares" ADD COLUMN "settlement_mode" "TenantInquiryShareSettlementMode" NOT NULL DEFAULT 'PARTNER_NATIVE',
ADD COLUMN "settlement_external_company_id" TEXT,
ADD COLUMN "migrated_from_external_at" TIMESTAMP(3),
ADD COLUMN "migrated_by_user_id" TEXT;

-- CreateIndex
CREATE INDEX "external_companies_linked_partner_tenant_id_idx" ON "external_companies"("linked_partner_tenant_id");

-- CreateIndex
CREATE INDEX "tenant_inquiry_shares_settlement_external_company_id_sync__idx" ON "tenant_inquiry_shares"("settlement_external_company_id", "sync_status");

-- AddForeignKey
ALTER TABLE "external_companies" ADD CONSTRAINT "external_companies_linked_partner_tenant_id_fkey" FOREIGN KEY ("linked_partner_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_inquiry_shares" ADD CONSTRAINT "tenant_inquiry_shares_settlement_external_company_id_fkey" FOREIGN KEY ("settlement_external_company_id") REFERENCES "external_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
