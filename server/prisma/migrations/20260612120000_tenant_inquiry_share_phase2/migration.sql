-- CreateEnum
CREATE TYPE "TenantInquiryShareDirection" AS ENUM ('LOW_TO_HIGH', 'HIGH_TO_LOW');

-- CreateEnum
CREATE TYPE "TenantInquiryShareSyncStatus" AS ENUM ('ACTIVE', 'PAUSED', 'REVOKED');

-- CreateTable
CREATE TABLE "tenant_inquiry_shares" (
    "id" TEXT NOT NULL,
    "partnership_id" TEXT NOT NULL,
    "source_tenant_id" TEXT NOT NULL,
    "source_inquiry_id" TEXT NOT NULL,
    "target_tenant_id" TEXT NOT NULL,
    "target_inquiry_id" TEXT NOT NULL,
    "direction" "TenantInquiryShareDirection" NOT NULL,
    "transfer_fee" INTEGER,
    "sync_status" "TenantInquiryShareSyncStatus" NOT NULL DEFAULT 'ACTIVE',
    "source_inquiry_number_snapshot" VARCHAR(24),
    "shared_at" TIMESTAMP(3) NOT NULL,
    "shared_by_user_id" TEXT,
    "cancel_fee_direction" "TenantInquiryShareDirection",

    CONSTRAINT "tenant_inquiry_shares_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_inquiry_shares_source_inquiry_id_key" ON "tenant_inquiry_shares"("source_inquiry_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_inquiry_shares_target_inquiry_id_key" ON "tenant_inquiry_shares"("target_inquiry_id");

-- CreateIndex
CREATE INDEX "tenant_inquiry_shares_partnership_id_idx" ON "tenant_inquiry_shares"("partnership_id");

-- CreateIndex
CREATE INDEX "tenant_inquiry_shares_source_tenant_id_shared_at_idx" ON "tenant_inquiry_shares"("source_tenant_id", "shared_at");

-- CreateIndex
CREATE INDEX "tenant_inquiry_shares_target_tenant_id_shared_at_idx" ON "tenant_inquiry_shares"("target_tenant_id", "shared_at");

-- AddForeignKey
ALTER TABLE "tenant_inquiry_shares" ADD CONSTRAINT "tenant_inquiry_shares_partnership_id_fkey" FOREIGN KEY ("partnership_id") REFERENCES "tenant_partnerships"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_inquiry_shares" ADD CONSTRAINT "tenant_inquiry_shares_source_inquiry_id_fkey" FOREIGN KEY ("source_inquiry_id") REFERENCES "inquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_inquiry_shares" ADD CONSTRAINT "tenant_inquiry_shares_target_inquiry_id_fkey" FOREIGN KEY ("target_inquiry_id") REFERENCES "inquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
