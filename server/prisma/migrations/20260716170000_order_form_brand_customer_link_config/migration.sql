-- 고객 발주서 링크 안내 메시지 — 영업 브랜드별 설정
CREATE TABLE IF NOT EXISTS "order_form_brand_customer_link_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "form_title" TEXT NOT NULL DEFAULT '입주청소 발주서',
    "price_label" TEXT DEFAULT '(특가)',
    "review_event_text" TEXT,
    "footer_notice_1" TEXT,
    "footer_notice_2" TEXT,
    "customer_link_total_line" TEXT,
    "customer_link_balance_line" TEXT,
    "customer_link_schedule_line" TEXT,
    "customer_link_time_detail_line" TEXT,
    "customer_link_order_intro" TEXT,
    "customer_link_cs_notice" TEXT,
    "customer_link_cs_url_label" TEXT,
    "customer_link_payback_block" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_form_brand_customer_link_configs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "order_form_brand_customer_link_configs_tenant_id_operating_company_id_key"
    ON "order_form_brand_customer_link_configs"("tenant_id", "operating_company_id");

CREATE INDEX IF NOT EXISTS "order_form_brand_customer_link_configs_tenant_id_idx"
    ON "order_form_brand_customer_link_configs"("tenant_id");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'order_form_brand_customer_link_configs_tenant_id_fkey'
    ) THEN
        ALTER TABLE "order_form_brand_customer_link_configs"
            ADD CONSTRAINT "order_form_brand_customer_link_configs_tenant_id_fkey"
            FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'order_form_brand_customer_link_configs_operating_company_id_fkey'
    ) THEN
        ALTER TABLE "order_form_brand_customer_link_configs"
            ADD CONSTRAINT "order_form_brand_customer_link_configs_operating_company_id_fkey"
            FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

-- 기존 테넌트 단일 설정 → 활성 브랜드별로 복사
INSERT INTO "order_form_brand_customer_link_configs" (
    "id",
    "tenant_id",
    "operating_company_id",
    "form_title",
    "price_label",
    "review_event_text",
    "footer_notice_1",
    "footer_notice_2",
    "customer_link_total_line",
    "customer_link_balance_line",
    "customer_link_schedule_line",
    "customer_link_time_detail_line",
    "customer_link_order_intro",
    "customer_link_cs_notice",
    "customer_link_cs_url_label",
    "customer_link_payback_block",
    "updated_at"
)
SELECT
    gen_random_uuid()::text,
    oc."tenant_id",
    oc."id",
    COALESCE(ofc."form_title", '입주청소 발주서'),
    ofc."price_label",
    ofc."review_event_text",
    ofc."footer_notice_1",
    ofc."footer_notice_2",
    ofc."customer_link_total_line",
    ofc."customer_link_balance_line",
    ofc."customer_link_schedule_line",
    ofc."customer_link_time_detail_line",
    ofc."customer_link_order_intro",
    ofc."customer_link_cs_notice",
    ofc."customer_link_cs_url_label",
    ofc."customer_link_payback_block",
    CURRENT_TIMESTAMP
FROM "operating_companies" oc
LEFT JOIN "order_form_config" ofc ON ofc."tenant_id" = oc."tenant_id"
WHERE oc."is_active" = true
ON CONFLICT ("tenant_id", "operating_company_id") DO NOTHING;
