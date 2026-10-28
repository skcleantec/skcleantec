-- CreateEnum
CREATE TYPE "BarobillMemberStatus" AS ENUM ('ACTIVE', 'LINK_REQUIRED', 'FAILED', 'PENDING_REVIEW', 'REJECTED', 'PROCESSING');

-- CreateTable
CREATE TABLE "barobill_members" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "env" VARCHAR(8) NOT NULL,
    "corp_num" VARCHAR(16) NOT NULL,
    "corp_name" VARCHAR(128) NOT NULL,
    "ceo_name" VARCHAR(128) NOT NULL,
    "biz_type" VARCHAR(64) NOT NULL,
    "biz_class" VARCHAR(64) NOT NULL,
    "addr1" TEXT NOT NULL,
    "addr2" VARCHAR(256),
    "contact_name" VARCHAR(128) NOT NULL,
    "contact_tel" VARCHAR(32) NOT NULL,
    "contact_email" VARCHAR(256) NOT NULL,
    "barobill_user_id" VARCHAR(20) NOT NULL DEFAULT '',
    "tax_type" VARCHAR(32),
    "business_registration_image_url" TEXT,
    "business_registration_image_public_id" VARCHAR(256),
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by_platform_user_id" TEXT,
    "reject_reason" TEXT,
    "status" "BarobillMemberStatus" NOT NULL,
    "last_error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "barobill_members_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "barobill_members_env_tenant_id_corp_num_key" ON "barobill_members"("env", "tenant_id", "corp_num");

-- CreateIndex
CREATE INDEX "barobill_members_tenant_id_env_idx" ON "barobill_members"("tenant_id", "env");

-- AddForeignKey
ALTER TABLE "barobill_members" ADD CONSTRAINT "barobill_members_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AlterTable
ALTER TABLE "operating_companies" ADD COLUMN "barobill_member_id" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "operating_companies_barobill_member_id_key" ON "operating_companies"("barobill_member_id");

-- AddForeignKey
ALTER TABLE "operating_companies" ADD CONSTRAINT "operating_companies_barobill_member_id_fkey" FOREIGN KEY ("barobill_member_id") REFERENCES "barobill_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;
