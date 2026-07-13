-- Tenant SaaS billing Phase 3 — schedule, custom pricing, adjustments, auto issue

CREATE TYPE "TenantBillingPricingMode" AS ENUM ('CATALOG', 'CUSTOM');
CREATE TYPE "TenantBillingAdjustmentType" AS ENUM ('SKIP', 'CUSTOM_AMOUNT', 'DEFER_SHIFT', 'DEFER_MERGE');
CREATE TYPE "TenantInvoiceSource" AS ENUM ('AUTO', 'MANUAL');

ALTER TABLE "tenant_billing_profiles" ADD COLUMN "pricing_mode" "TenantBillingPricingMode" NOT NULL DEFAULT 'CATALOG';
ALTER TABLE "tenant_billing_profiles" ADD COLUMN "custom_monthly_amount_krw" INTEGER;
ALTER TABLE "tenant_billing_profiles" ADD COLUMN "custom_annual_amount_krw" INTEGER;
ALTER TABLE "tenant_billing_profiles" ADD COLUMN "billing_due_day" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "tenant_billing_profiles" ADD COLUMN "billing_start_date" TIMESTAMP(3);
ALTER TABLE "tenant_billing_profiles" ADD COLUMN "auto_issue_enabled" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "tenant_billing_profiles" ADD COLUMN "contract_memo" TEXT;

UPDATE "tenant_billing_profiles"
SET "billing_due_day" = COALESCE("billing_anchor_day", 25)
WHERE "billing_due_day" = 25;

ALTER TABLE "tenant_billing_profiles" DROP COLUMN IF EXISTS "billing_anchor_day";

UPDATE "tenant_billing_profiles" p
SET "billing_start_date" = t."service_started_at"
FROM "tenants" t
WHERE t."id" = p."tenant_id"
  AND p."billing_start_date" IS NULL
  AND t."service_started_at" IS NOT NULL;

CREATE TABLE "tenant_billing_adjustments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "type" "TenantBillingAdjustmentType" NOT NULL,
    "target_period_start" TIMESTAMP(3) NOT NULL,
    "custom_amount_krw" INTEGER,
    "reason" TEXT NOT NULL,
    "created_by_platform_user_id" TEXT,
    "voided_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_billing_adjustments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tenant_billing_adjustments_tenant_id_target_period_start_idx"
    ON "tenant_billing_adjustments"("tenant_id", "target_period_start");
CREATE INDEX "tenant_billing_adjustments_tenant_id_voided_at_idx"
    ON "tenant_billing_adjustments"("tenant_id", "voided_at");

ALTER TABLE "tenant_billing_adjustments" ADD CONSTRAINT "tenant_billing_adjustments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_billing_adjustments" ADD CONSTRAINT "tenant_billing_adjustments_created_by_platform_user_id_fkey"
    FOREIGN KEY ("created_by_platform_user_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "tenant_invoices" ADD COLUMN "source" "TenantInvoiceSource" NOT NULL DEFAULT 'MANUAL';
ALTER TABLE "tenant_invoices" ADD COLUMN "catalog_amount_krw" INTEGER;
ALTER TABLE "tenant_invoices" ADD COLUMN "adjustment_id" TEXT;

ALTER TABLE "tenant_invoices" ADD CONSTRAINT "tenant_invoices_adjustment_id_fkey"
    FOREIGN KEY ("adjustment_id") REFERENCES "tenant_billing_adjustments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
