-- CreateTable
CREATE TABLE "tax_invoice_buyers" (
    "id" TEXT NOT NULL,
    "owner_type" VARCHAR(16) NOT NULL,
    "tenant_id" TEXT,
    "biz_number" VARCHAR(10) NOT NULL,
    "corp_name" VARCHAR(128) NOT NULL,
    "ceo_name" VARCHAR(128) NOT NULL DEFAULT '',
    "addr" VARCHAR(300) NOT NULL DEFAULT '',
    "biz_type" VARCHAR(64) NOT NULL DEFAULT '',
    "biz_class" VARCHAR(64) NOT NULL DEFAULT '',
    "email" VARCHAR(256) NOT NULL DEFAULT '',
    "email2" VARCHAR(256) NOT NULL DEFAULT '',
    "contact_name" VARCHAR(80) NOT NULL DEFAULT '',
    "tel" VARCHAR(40) NOT NULL DEFAULT '',
    "memo" VARCHAR(300) NOT NULL DEFAULT '',
    "last_used_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tax_invoice_buyers_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey (optional — only links TENANT-scoped rows)
ALTER TABLE "tax_invoice_buyers" ADD CONSTRAINT "tax_invoice_buyers_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateIndex (유니크: NULL tenantId 는 COALESCE 로 빈 문자열로 치환)
CREATE UNIQUE INDEX "tax_invoice_buyers_owner_tenant_biz_key"
    ON "tax_invoice_buyers" ("owner_type", COALESCE("tenant_id", ''), "biz_number");

-- CreateIndex (목록 조회 성능)
CREATE INDEX "tax_invoice_buyers_owner_tenant_last_used_idx"
    ON "tax_invoice_buyers" ("owner_type", "tenant_id", "last_used_at" DESC);

CREATE INDEX "tax_invoice_buyers_owner_tenant_corp_name_idx"
    ON "tax_invoice_buyers" ("owner_type", "tenant_id", "corp_name");
