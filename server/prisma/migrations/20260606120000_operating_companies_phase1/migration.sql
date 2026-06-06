-- Phase 1: OperatingCompany, UserOperatingCompany, Inquiry.operatingCompanyId, counter scope

CREATE TABLE "operating_companies" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "slug" VARCHAR(48) NOT NULL,
    "is_default" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "operating_companies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "operating_companies_tenant_id_slug_key" ON "operating_companies"("tenant_id", "slug");
CREATE INDEX "operating_companies_tenant_id_is_active_sort_order_idx" ON "operating_companies"("tenant_id", "is_active", "sort_order");

ALTER TABLE "operating_companies" ADD CONSTRAINT "operating_companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 테넌트마다 기본 영업 업체 1개 (기존 Tenant.config 브랜딩 이관)
INSERT INTO "operating_companies" ("id", "tenant_id", "name", "slug", "is_default", "is_active", "sort_order", "config", "created_at", "updated_at")
SELECT
    gen_random_uuid()::text,
    t."id",
    t."name",
    t."slug",
    true,
    true,
    0,
    COALESCE(t."config", '{}'::jsonb),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "tenants" t;

CREATE TABLE "user_operating_companies" (
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_operating_companies_pkey" PRIMARY KEY ("user_id", "operating_company_id")
);

CREATE INDEX "user_operating_companies_tenant_id_user_id_idx" ON "user_operating_companies"("tenant_id", "user_id");
CREATE INDEX "user_operating_companies_tenant_id_operating_company_id_idx" ON "user_operating_companies"("tenant_id", "operating_company_id");

ALTER TABLE "user_operating_companies" ADD CONSTRAINT "user_operating_companies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_operating_companies" ADD CONSTRAINT "user_operating_companies_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_operating_companies" ADD CONSTRAINT "user_operating_companies_operating_company_id_fkey" FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "user_operating_companies" ("tenant_id", "user_id", "operating_company_id", "is_primary")
SELECT u."tenant_id", u."id", oc."id", true
FROM "users" u
JOIN "operating_companies" oc ON oc."tenant_id" = u."tenant_id" AND oc."is_default" = true;

ALTER TABLE "inquiries" ADD COLUMN "operating_company_id" TEXT;

UPDATE "inquiries" i
SET "operating_company_id" = oc."id"
FROM "operating_companies" oc
WHERE oc."tenant_id" = i."tenant_id" AND oc."is_default" = true;

ALTER TABLE "inquiries" ALTER COLUMN "operating_company_id" SET NOT NULL;

ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_operating_company_id_fkey" FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "inquiries_tenant_id_operating_company_id_created_at_idx" ON "inquiries"("tenant_id", "operating_company_id", "created_at");

ALTER TABLE "inquiries" ALTER COLUMN "inquiry_number" TYPE VARCHAR(24);

-- daily_inquiry_counters: 영업 업체 스코프
ALTER TABLE "daily_inquiry_counters" ADD COLUMN "operating_company_id" TEXT;

UPDATE "daily_inquiry_counters" dic
SET "operating_company_id" = oc."id"
FROM "operating_companies" oc
WHERE oc."tenant_id" = dic."tenant_id" AND oc."is_default" = true;

ALTER TABLE "daily_inquiry_counters" ALTER COLUMN "operating_company_id" SET NOT NULL;

ALTER TABLE "daily_inquiry_counters" DROP CONSTRAINT "daily_inquiry_counters_pkey";
ALTER TABLE "daily_inquiry_counters" ADD CONSTRAINT "daily_inquiry_counters_pkey" PRIMARY KEY ("tenant_id", "operating_company_id", "date_key");

ALTER TABLE "daily_inquiry_counters" ADD CONSTRAINT "daily_inquiry_counters_operating_company_id_fkey" FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
