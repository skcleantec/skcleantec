-- 공동인증서 캐시, 세금계산서 발급, 보류 구분

ALTER TABLE "barobill_members"
  ADD COLUMN "cert_valid" BOOLEAN,
  ADD COLUMN "cert_expire_date" VARCHAR(16),
  ADD COLUMN "cert_checked_at" TIMESTAMP(3),
  ADD COLUMN "cert_warn_for_expire" VARCHAR(16);

ALTER TABLE "cashbill_platform_holds"
  ADD COLUMN "kind" VARCHAR(16) NOT NULL DEFAULT 'cashbill';

CREATE TABLE "tax_invoice_issues" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "inquiry_id" TEXT,
    "operating_company_id" TEXT NOT NULL,
    "mgt_key" VARCHAR(24) NOT NULL,
    "purpose_type" INTEGER NOT NULL,
    "write_date" VARCHAR(8) NOT NULL,
    "buyer_corp_num" VARCHAR(16) NOT NULL,
    "buyer_corp_name" VARCHAR(128) NOT NULL,
    "buyer_ceo_name" VARCHAR(128) NOT NULL,
    "buyer_addr" VARCHAR(300) NOT NULL,
    "buyer_email" VARCHAR(256) NOT NULL,
    "buyer_biz_type" VARCHAR(64) NOT NULL DEFAULT '',
    "buyer_biz_class" VARCHAR(64) NOT NULL DEFAULT '',
    "supply_amount" INTEGER NOT NULL,
    "tax_amount" INTEGER NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "lines" JSONB NOT NULL,
    "internal_memo" VARCHAR(500),
    "barobill_state" VARCHAR(8),
    "nts_send_state" VARCHAR(8),
    "charged_krw" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_invoice_issues_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tax_invoice_issues_member_id_mgt_key_key" ON "tax_invoice_issues"("member_id", "mgt_key");
CREATE INDEX "tax_invoice_issues_tenant_id_created_at_idx" ON "tax_invoice_issues"("tenant_id", "created_at" DESC);
CREATE INDEX "tax_invoice_issues_tenant_id_inquiry_id_idx" ON "tax_invoice_issues"("tenant_id", "inquiry_id");
CREATE INDEX "tax_invoice_issues_tenant_id_operating_company_id_created_at_idx" ON "tax_invoice_issues"("tenant_id", "operating_company_id", "created_at" DESC);
CREATE INDEX "tax_invoice_issues_nts_send_state_idx" ON "tax_invoice_issues"("nts_send_state");

ALTER TABLE "tax_invoice_issues" ADD CONSTRAINT "tax_invoice_issues_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tax_invoice_issues" ADD CONSTRAINT "tax_invoice_issues_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "barobill_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tax_invoice_issues" ADD CONSTRAINT "tax_invoice_issues_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "tax_invoice_issues" ADD CONSTRAINT "tax_invoice_issues_operating_company_id_fkey" FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
