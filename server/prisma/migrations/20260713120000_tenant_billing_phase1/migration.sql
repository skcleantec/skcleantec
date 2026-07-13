-- Tenant SaaS billing Phase 1

CREATE TYPE "TenantSuspendReason" AS ENUM ('TRIAL_EXPIRED', 'BILLING_OVERDUE', 'PLATFORM');
CREATE TYPE "TenantBillingCycle" AS ENUM ('MONTHLY', 'ANNUAL');
CREATE TYPE "TenantInvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PAID', 'OVERDUE', 'VOID');

ALTER TABLE "tenants" ADD COLUMN "trial_ends_at" TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN "prepaid_confirmed_at" TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN "service_started_at" TIMESTAMP(3);
ALTER TABLE "tenants" ADD COLUMN "suspend_reason" "TenantSuspendReason";
ALTER TABLE "tenants" ADD COLUMN "billing_access_blocked_at" TIMESTAMP(3);

CREATE TABLE "platform_billing_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "bank_name" VARCHAR(64),
    "account_number" VARCHAR(64),
    "account_holder" VARCHAR(64),
    "payment_guide_text" TEXT,
    "overdue_grace_days" INTEGER NOT NULL DEFAULT 3,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_billing_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "platform_billing_settings" ("id", "updated_at")
VALUES ('default', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;

CREATE TABLE "tenant_billing_profiles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "billing_cycle" "TenantBillingCycle" NOT NULL DEFAULT 'MONTHLY',
    "billing_anchor_day" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_billing_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_billing_profiles_tenant_id_key" ON "tenant_billing_profiles"("tenant_id");

ALTER TABLE "tenant_billing_profiles" ADD CONSTRAINT "tenant_billing_profiles_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tenant_invoices" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "billing_cycle" "TenantBillingCycle" NOT NULL,
    "plan" VARCHAR(32) NOT NULL,
    "amount_krw" INTEGER NOT NULL,
    "due_date" TIMESTAMP(3) NOT NULL,
    "status" "TenantInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "paid_at" TIMESTAMP(3),
    "confirmed_by_platform_user_id" TEXT,
    "confirmed_at" TIMESTAMP(3),
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_invoices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tenant_invoices_tenant_id_status_idx" ON "tenant_invoices"("tenant_id", "status");
CREATE INDEX "tenant_invoices_tenant_id_due_date_idx" ON "tenant_invoices"("tenant_id", "due_date");

ALTER TABLE "tenant_invoices" ADD CONSTRAINT "tenant_invoices_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_invoices" ADD CONSTRAINT "tenant_invoices_confirmed_by_platform_user_id_fkey"
    FOREIGN KEY ("confirmed_by_platform_user_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 체험 중 테넌트: trial_ends_at 백필 (가입일 + 7일)
UPDATE "tenants"
SET "trial_ends_at" = "created_at" + INTERVAL '7 days'
WHERE "status" = 'TRIAL' AND "trial_ends_at" IS NULL;

-- 기존 ACTIVE/SUSPENDED 테넌트에 기본 billing profile
INSERT INTO "tenant_billing_profiles" ("id", "tenant_id", "billing_cycle", "updated_at")
SELECT gen_random_uuid()::text, t."id", 'MONTHLY', CURRENT_TIMESTAMP
FROM "tenants" t
WHERE NOT EXISTS (
    SELECT 1 FROM "tenant_billing_profiles" p WHERE p."tenant_id" = t."id"
);
