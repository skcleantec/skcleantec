-- AlterTable
ALTER TABLE "external_companies" ADD COLUMN "usage_disabled_at" TIMESTAMP(3),
ADD COLUMN "usage_disabled_by_user_id" TEXT;

-- CreateIndex
CREATE INDEX "external_companies_tenant_id_is_active_usage_disabled_at_idx" ON "external_companies"("tenant_id", "is_active", "usage_disabled_at");
