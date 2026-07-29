-- CreateEnum
CREATE TYPE "TenantPlanUpgradeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "tenant_plan_upgrade_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "requested_plan" VARCHAR(32) NOT NULL,
    "status" "TenantPlanUpgradeRequestStatus" NOT NULL DEFAULT 'PENDING',
    "message" VARCHAR(2000),
    "admin_note" VARCHAR(2000),
    "requester_user_id" TEXT,
    "reviewed_by_platform_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_plan_upgrade_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_plan_upgrade_requests_tenant_id_status_created_at_idx" ON "tenant_plan_upgrade_requests"("tenant_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "tenant_plan_upgrade_requests_status_created_at_idx" ON "tenant_plan_upgrade_requests"("status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "tenant_plan_upgrade_requests" ADD CONSTRAINT "tenant_plan_upgrade_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_plan_upgrade_requests" ADD CONSTRAINT "tenant_plan_upgrade_requests_requester_user_id_fkey" FOREIGN KEY ("requester_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_plan_upgrade_requests" ADD CONSTRAINT "tenant_plan_upgrade_requests_reviewed_by_platform_user_id_fkey" FOREIGN KEY ("reviewed_by_platform_user_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
