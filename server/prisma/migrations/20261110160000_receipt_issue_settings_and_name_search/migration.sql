-- 발행 기본설정
CREATE TABLE "receipt_issue_settings" (
    "id" TEXT NOT NULL,
    "owner_type" VARCHAR(16) NOT NULL,
    "tenant_id" TEXT,
    "operating_company_id" TEXT,
    "kind" VARCHAR(16) NOT NULL,
    "values" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "receipt_issue_settings_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "receipt_issue_settings"
  ADD CONSTRAINT "receipt_issue_settings_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "receipt_issue_settings"
  ADD CONSTRAINT "receipt_issue_settings_operating_company_id_fkey"
  FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE UNIQUE INDEX "receipt_issue_settings_owner_tenant_brand_kind_key"
  ON "receipt_issue_settings" (
    "owner_type",
    COALESCE("tenant_id", ''),
    COALESCE("operating_company_id", ''),
    "kind"
  );

CREATE INDEX "receipt_issue_settings_owner_tenant_kind_idx"
  ON "receipt_issue_settings" ("owner_type", "tenant_id", "kind");

-- 이름 검색 가속 (ILIKE contains)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS "inquiries_customer_name_trgm_idx"
  ON "inquiries" USING gin ("customer_name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "inquiries_nickname_trgm_idx"
  ON "inquiries" USING gin ("nickname" gin_trgm_ops)
  WHERE "nickname" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "inquiries_address_trgm_idx"
  ON "inquiries" USING gin ("address" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "inquiries_inquiry_number_trgm_idx"
  ON "inquiries" USING gin ("inquiry_number" gin_trgm_ops)
  WHERE "inquiry_number" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "order_forms_customer_name_trgm_idx"
  ON "order_forms" USING gin ("customer_name" gin_trgm_ops);

CREATE INDEX IF NOT EXISTS "inquiries_customer_name_key_trgm_idx"
  ON "inquiries" USING gin (
    (regexp_replace(regexp_replace(lower("customer_name"), '\s+', '', 'g'), '(고객님|고객|님)+$', '')) gin_trgm_ops
  );

-- 업체 공통 기본값 시드 (현금영수증 과세 · 세금계산서 과세)
INSERT INTO "receipt_issue_settings" ("id", "owner_type", "tenant_id", "operating_company_id", "kind", "values", "created_at", "updated_at")
SELECT gen_random_uuid()::text, 'TENANT', t.id, NULL, 'CASHBILL',
  '{"taxKind":"taxable","usage":"phone","itemName":"청소 서비스","amountBasis":"balance","memo":""}'::jsonb,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "receipt_issue_settings" s
  WHERE s.owner_type = 'TENANT' AND s.tenant_id = t.id AND s.operating_company_id IS NULL AND s.kind = 'CASHBILL'
);

INSERT INTO "receipt_issue_settings" ("id", "owner_type", "tenant_id", "operating_company_id", "kind", "values", "created_at", "updated_at")
SELECT gen_random_uuid()::text, 'TENANT', t.id, NULL, 'TAXINVOICE',
  '{"taxKind":"taxable","purposeType":1,"itemName":"","writeDateBasis":"today","buyerEmail":"","remark":""}'::jsonb,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "receipt_issue_settings" s
  WHERE s.owner_type = 'TENANT' AND s.tenant_id = t.id AND s.operating_company_id IS NULL AND s.kind = 'TAXINVOICE'
);

-- SK클린텍(sk / skcleanteck): 현금영수증 면세
UPDATE "receipt_issue_settings" s
SET "values" = '{"taxKind":"exempt","usage":"phone","itemName":"청소 서비스","amountBasis":"balance","memo":""}'::jsonb,
    "updated_at" = CURRENT_TIMESTAMP
FROM "tenants" t
WHERE s.tenant_id = t.id
  AND s.owner_type = 'TENANT'
  AND s.kind = 'CASHBILL'
  AND s.operating_company_id IS NULL
  AND t.slug IN ('sk', 'skcleanteck');

-- 플랫폼 기본 1줄씩
INSERT INTO "receipt_issue_settings" ("id", "owner_type", "tenant_id", "operating_company_id", "kind", "values", "created_at", "updated_at")
SELECT gen_random_uuid()::text, 'PLATFORM', NULL, NULL, 'CASHBILL',
  '{"taxKind":"taxable","usage":"phone","itemName":"청소비서 이용료","amountBasis":"balance","memo":""}'::jsonb,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "receipt_issue_settings" s
  WHERE s.owner_type = 'PLATFORM' AND s.tenant_id IS NULL AND s.kind = 'CASHBILL'
);

INSERT INTO "receipt_issue_settings" ("id", "owner_type", "tenant_id", "operating_company_id", "kind", "values", "created_at", "updated_at")
SELECT gen_random_uuid()::text, 'PLATFORM', NULL, NULL, 'TAXINVOICE',
  '{"taxKind":"taxable","purposeType":1,"itemName":"청소비서 이용료","writeDateBasis":"today","buyerEmail":"","remark":""}'::jsonb,
  CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "receipt_issue_settings" s
  WHERE s.owner_type = 'PLATFORM' AND s.tenant_id IS NULL AND s.kind = 'TAXINVOICE'
);
