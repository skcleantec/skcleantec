-- CreateEnum
CREATE TYPE "CardPaymentMethod" AS ENUM ('KEYIN', 'CUSTOMER_LINK');

-- CreateEnum
CREATE TYPE "CardPaymentStatus" AS ENUM ('DRAFT', 'AWAITING_PG', 'LINK_SENT', 'APPROVED', 'CANCELLED', 'FAILED');

-- CreateEnum
CREATE TYPE "TenantPgOnboardingStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'FORWARDED_TO_PG', 'APPROVED', 'REJECTED');

-- CreateTable
CREATE TABLE "platform_card_payment_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "tenant_fee_bps" INTEGER NOT NULL DEFAULT 330,
    "platform_cost_bps" INTEGER NOT NULL DEFAULT 260,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_card_payment_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_pg_onboardings" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "status" "TenantPgOnboardingStatus" NOT NULL DEFAULT 'DRAFT',
    "business_name" VARCHAR(128),
    "biz_number" VARCHAR(64),
    "representative_name" VARCHAR(128),
    "representative_birth" VARCHAR(16),
    "address_line" TEXT,
    "contact_name" VARCHAR(128),
    "contact_phone" VARCHAR(64),
    "contact_email" VARCHAR(256),
    "bank_name" VARCHAR(64),
    "bank_account" VARCHAR(64),
    "account_holder" VARCHAR(128),
    "website_url" VARCHAR(512),
    "note" TEXT,
    "submitted_at" TIMESTAMP(3),
    "forwarded_at" TIMESTAMP(3),
    "decided_at" TIMESTAMP(3),
    "platform_memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_pg_onboardings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_pg_credentials" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "api_key_enc" TEXT NOT NULL,
    "tid_enc" TEXT NOT NULL,
    "webhook_secret_enc" TEXT,
    "api_key_last4" VARCHAR(8) NOT NULL,
    "tid_masked" VARCHAR(32) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "connected_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_pg_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_payments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "inquiry_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "method" "CardPaymentMethod" NOT NULL,
    "status" "CardPaymentStatus" NOT NULL DEFAULT 'DRAFT',
    "amount_won" INTEGER NOT NULL,
    "tenant_fee_bps" INTEGER NOT NULL,
    "platform_cost_bps" INTEGER NOT NULL,
    "tenant_fee_won" INTEGER NOT NULL,
    "platform_cost_won" INTEGER NOT NULL,
    "platform_spread_won" INTEGER NOT NULL,
    "tenant_net_won" INTEGER NOT NULL,
    "customer_name" VARCHAR(128) NOT NULL,
    "customer_phone_masked" VARCHAR(32),
    "inquiry_number" VARCHAR(24),
    "card_last4" VARCHAR(4),
    "approval_no" VARCHAR(64),
    "pg_order_id" VARCHAR(64),
    "webhook_event_id" VARCHAR(128),
    "link_token_hash" VARCHAR(128),
    "link_expires_at" TIMESTAMP(3),
    "paid_at" TIMESTAMP(3),
    "fail_reason" VARCHAR(256),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_payments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_pg_onboardings_tenant_id_key" ON "tenant_pg_onboardings"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_pg_onboardings_status_submitted_at_idx" ON "tenant_pg_onboardings"("status", "submitted_at");

-- CreateIndex
CREATE UNIQUE INDEX "tenant_pg_credentials_tenant_id_key" ON "tenant_pg_credentials"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "card_payments_pg_order_id_key" ON "card_payments"("pg_order_id");

-- CreateIndex
CREATE UNIQUE INDEX "card_payments_webhook_event_id_key" ON "card_payments"("webhook_event_id");

-- CreateIndex
CREATE UNIQUE INDEX "card_payments_link_token_hash_key" ON "card_payments"("link_token_hash");

-- CreateIndex
CREATE INDEX "card_payments_tenant_id_created_at_idx" ON "card_payments"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "card_payments_tenant_id_status_idx" ON "card_payments"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "card_payments_tenant_id_created_by_id_idx" ON "card_payments"("tenant_id", "created_by_id");

-- CreateIndex
CREATE INDEX "card_payments_inquiry_id_idx" ON "card_payments"("inquiry_id");

-- AddForeignKey
ALTER TABLE "tenant_pg_onboardings" ADD CONSTRAINT "tenant_pg_onboardings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_pg_credentials" ADD CONSTRAINT "tenant_pg_credentials_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_payments" ADD CONSTRAINT "card_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_payments" ADD CONSTRAINT "card_payments_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_payments" ADD CONSTRAINT "card_payments_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "platform_card_payment_settings" ("id", "tenant_fee_bps", "platform_cost_bps", "updated_at")
VALUES ('default', 330, 260, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
