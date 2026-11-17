-- 브랜드 카카오 채널, 서식 심사, 세팅비 1회 청구

ALTER TABLE "platform_billing_settings"
  ADD COLUMN "alimtalk_brand_setup_fee_krw" INTEGER NOT NULL DEFAULT 99000,
  ADD COLUMN "alimtalk_brand_custom_copy_fee_krw" INTEGER NOT NULL DEFAULT 30000;

ALTER TABLE "alimtalk_send_logs"
  ADD COLUMN "sent_channel_id" VARCHAR(64);

CREATE TABLE "alimtalk_brand_channels" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "operating_company_id" TEXT NOT NULL,
  "search_id" VARCHAR(64) NOT NULL,
  "admin_phone" VARCHAR(32) NOT NULL,
  "biz_verify" VARCHAR(16) NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "provider_channel_id" VARCHAR(64),
  "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "linked_at" TIMESTAMP(3),
  "note" TEXT,
  "setup_fee_krw" INTEGER NOT NULL,
  "setup_fee_billed_at" TIMESTAMP(3),
  "setup_fee_excluded" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "alimtalk_brand_channels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "alimtalk_brand_channels_operating_company_id_key"
  ON "alimtalk_brand_channels"("operating_company_id");
CREATE INDEX "alimtalk_brand_channels_tenant_id_status_idx"
  ON "alimtalk_brand_channels"("tenant_id", "status");

ALTER TABLE "alimtalk_brand_channels"
  ADD CONSTRAINT "alimtalk_brand_channels_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "alimtalk_brand_channels"
  ADD CONSTRAINT "alimtalk_brand_channels_operating_company_id_fkey"
  FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "alimtalk_brand_templates" (
  "id" TEXT NOT NULL,
  "brand_channel_id" TEXT NOT NULL,
  "template_code" VARCHAR(64) NOT NULL,
  "provider_template_name" VARCHAR(200) NOT NULL,
  "status" VARCHAR(16) NOT NULL,
  "reject_reason" TEXT,
  "submitted_at" TIMESTAMP(3),
  "approved_at" TIMESTAMP(3),
  "last_checked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "alimtalk_brand_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "alimtalk_brand_templates_brand_channel_id_template_code_key"
  ON "alimtalk_brand_templates"("brand_channel_id", "template_code");
CREATE INDEX "alimtalk_brand_templates_brand_channel_id_status_idx"
  ON "alimtalk_brand_templates"("brand_channel_id", "status");

ALTER TABLE "alimtalk_brand_templates"
  ADD CONSTRAINT "alimtalk_brand_templates_brand_channel_id_fkey"
  FOREIGN KEY ("brand_channel_id") REFERENCES "alimtalk_brand_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "tenant_billing_one_time_charges" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "label" VARCHAR(200) NOT NULL,
  "amount_krw" INTEGER NOT NULL,
  "source_key" VARCHAR(80) NOT NULL,
  "invoice_id" TEXT,
  "voided_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_billing_one_time_charges_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_billing_one_time_charges_source_key_key"
  ON "tenant_billing_one_time_charges"("source_key");
CREATE INDEX "tenant_billing_one_time_charges_tenant_id_voided_at_idx"
  ON "tenant_billing_one_time_charges"("tenant_id", "voided_at");

ALTER TABLE "tenant_billing_one_time_charges"
  ADD CONSTRAINT "tenant_billing_one_time_charges_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tenant_billing_one_time_charges"
  ADD CONSTRAINT "tenant_billing_one_time_charges_invoice_id_fkey"
  FOREIGN KEY ("invoice_id") REFERENCES "tenant_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
