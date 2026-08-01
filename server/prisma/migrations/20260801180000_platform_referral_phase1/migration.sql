-- CreateEnum
CREATE TYPE "PlatformReferrerType" AS ENUM ('INDIVIDUAL', 'PARTNER');

-- CreateEnum
CREATE TYPE "PlatformReferrerStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "TenantReferralSignupMethod" AS ENUM ('REF_LINK', 'MANUAL_CODE', 'PLATFORM_ASSIGNED');

-- CreateEnum
CREATE TYPE "PlatformReferrerCommissionStatus" AS ENUM ('PENDING', 'APPROVED', 'PAID', 'REVERSED');

-- CreateTable
CREATE TABLE "platform_referrers" (
    "id" TEXT NOT NULL,
    "type" "PlatformReferrerType" NOT NULL,
    "code" VARCHAR(48) NOT NULL,
    "display_name" VARCHAR(128) NOT NULL,
    "contact_email" VARCHAR(256),
    "contact_phone" VARCHAR(32),
    "partner_tenant_id" TEXT,
    "commission_rate_bps" INTEGER NOT NULL DEFAULT 500,
    "eligible_plan_ids" JSONB,
    "status" "PlatformReferrerStatus" NOT NULL DEFAULT 'ACTIVE',
    "payout_bank_info" JSONB,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_referrers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_referral_attributions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "referrer_id" TEXT NOT NULL,
    "signup_method" "TenantReferralSignupMethod" NOT NULL,
    "ref_code_used" VARCHAR(48) NOT NULL,
    "attributed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tenant_referral_attributions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_referrer_commission_accruals" (
    "id" TEXT NOT NULL,
    "referrer_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "attribution_id" TEXT NOT NULL,
    "invoice_id" TEXT NOT NULL,
    "period_ym" VARCHAR(7) NOT NULL,
    "invoice_paid_amount" INTEGER NOT NULL,
    "commission_rate_bps" INTEGER NOT NULL,
    "commission_amount" INTEGER NOT NULL,
    "status" "PlatformReferrerCommissionStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "paid_memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_referrer_commission_accruals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_referrers_code_key" ON "platform_referrers"("code");

-- CreateIndex
CREATE INDEX "platform_referrers_status_idx" ON "platform_referrers"("status");

-- CreateIndex
CREATE INDEX "platform_referrers_partner_tenant_id_idx" ON "platform_referrers"("partner_tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_referral_attributions_tenant_id_key" ON "tenant_referral_attributions"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_referral_attributions_referrer_id_attributed_at_idx" ON "tenant_referral_attributions"("referrer_id", "attributed_at");

-- CreateIndex
CREATE UNIQUE INDEX "platform_referrer_commission_accruals_referrer_id_invoice_id_key" ON "platform_referrer_commission_accruals"("referrer_id", "invoice_id");

-- CreateIndex
CREATE INDEX "platform_referrer_commission_accruals_referrer_id_status_idx" ON "platform_referrer_commission_accruals"("referrer_id", "status");

-- CreateIndex
CREATE INDEX "platform_referrer_commission_accruals_tenant_id_idx" ON "platform_referrer_commission_accruals"("tenant_id");

-- CreateIndex
CREATE INDEX "platform_referrer_commission_accruals_period_ym_idx" ON "platform_referrer_commission_accruals"("period_ym");

-- AddForeignKey
ALTER TABLE "platform_referrers" ADD CONSTRAINT "platform_referrers_partner_tenant_id_fkey" FOREIGN KEY ("partner_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_referral_attributions" ADD CONSTRAINT "tenant_referral_attributions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_referral_attributions" ADD CONSTRAINT "tenant_referral_attributions_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "platform_referrers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_referrer_commission_accruals" ADD CONSTRAINT "platform_referrer_commission_accruals_referrer_id_fkey" FOREIGN KEY ("referrer_id") REFERENCES "platform_referrers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_referrer_commission_accruals" ADD CONSTRAINT "platform_referrer_commission_accruals_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_referrer_commission_accruals" ADD CONSTRAINT "platform_referrer_commission_accruals_attribution_id_fkey" FOREIGN KEY ("attribution_id") REFERENCES "tenant_referral_attributions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_referrer_commission_accruals" ADD CONSTRAINT "platform_referrer_commission_accruals_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "tenant_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
