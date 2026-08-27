-- Alimtalk foundation: templates, wallet, settings, send logs

CREATE TABLE "alimtalk_templates" (
    "id" TEXT NOT NULL,
    "code" VARCHAR(64) NOT NULL,
    "solapi_template_id" VARCHAR(64) NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "trigger_type" VARCHAR(32) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alimtalk_templates_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "alimtalk_templates_code_key" ON "alimtalk_templates"("code");

CREATE TABLE "tenant_alimtalk_wallets" (
    "tenant_id" TEXT NOT NULL,
    "prepaid_balance_krw" INTEGER NOT NULL DEFAULT 0,
    "monthly_free_used" INTEGER NOT NULL DEFAULT 0,
    "monthly_free_period_ym" VARCHAR(7) NOT NULL DEFAULT '',
    "monthly_free_enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_alimtalk_wallets_pkey" PRIMARY KEY ("tenant_id")
);

CREATE TABLE "tenant_alimtalk_template_settings" (
    "tenant_id" TEXT NOT NULL,
    "template_code" VARCHAR(64) NOT NULL,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "tenant_alimtalk_template_settings_pkey" PRIMARY KEY ("tenant_id","template_code")
);

CREATE TABLE "alimtalk_send_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "template_code" VARCHAR(64) NOT NULL,
    "order_form_id" TEXT,
    "inquiry_id" TEXT,
    "to_phone" VARCHAR(32) NOT NULL,
    "solapi_message_id" VARCHAR(64),
    "charge_status" VARCHAR(16) NOT NULL,
    "delivered_channel" VARCHAR(8),
    "free_units_consumed" INTEGER NOT NULL DEFAULT 0,
    "tenant_unit_price_krw" INTEGER NOT NULL DEFAULT 0,
    "customer_facing_tenant_id" TEXT,
    "customer_facing_operating_company_id" TEXT,
    "error_message" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alimtalk_send_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "alimtalk_send_logs_tenant_id_created_at_idx" ON "alimtalk_send_logs"("tenant_id", "created_at" DESC);
CREATE INDEX "alimtalk_send_logs_tenant_id_template_code_order_form_id_idx" ON "alimtalk_send_logs"("tenant_id", "template_code", "order_form_id");
CREATE INDEX "alimtalk_send_logs_tenant_id_template_code_inquiry_id_idx" ON "alimtalk_send_logs"("tenant_id", "template_code", "inquiry_id");

ALTER TABLE "tenant_alimtalk_wallets" ADD CONSTRAINT "tenant_alimtalk_wallets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "tenant_alimtalk_template_settings" ADD CONSTRAINT "tenant_alimtalk_template_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "alimtalk_send_logs" ADD CONSTRAINT "alimtalk_send_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
