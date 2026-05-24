-- Phase 1: Tenant / PlatformUser + User.tenantId + Inquiry.tenantId (SK클린텍 백필)
-- Default tenant id is stable for seed/scripts.

-- CreateEnum
CREATE TYPE "TenantStatus" AS ENUM ('TRIAL', 'ACTIVE', 'SUSPENDED');
CREATE TYPE "PlatformRole" AS ENUM ('SUPER_ADMIN', 'SUPPORT');

-- CreateTable
CREATE TABLE "tenants" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(48) NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "status" "TenantStatus" NOT NULL DEFAULT 'ACTIVE',
    "plan" VARCHAR(32) NOT NULL DEFAULT 'premium',
    "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Seoul',
    "config" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "suspended_at" TIMESTAMP(3),

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "platform_users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "PlatformRole" NOT NULL DEFAULT 'SUPER_ADMIN',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_users_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE UNIQUE INDEX "platform_users_email_key" ON "platform_users"("email");

-- Default SK클린텍 tenant
INSERT INTO "tenants" ("id", "slug", "name", "status", "plan")
VALUES (
    'a0000000-0000-4000-8000-000000000001',
    'skcleanteck',
    'SK클린텍',
    'ACTIVE',
    'premium'
);

-- User: tenant_id + is_tenant_owner
ALTER TABLE "users" ADD COLUMN "tenant_id" TEXT;
ALTER TABLE "users" ADD COLUMN "is_tenant_owner" BOOLEAN NOT NULL DEFAULT false;

UPDATE "users" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

ALTER TABLE "users" ALTER COLUMN "tenant_id" SET NOT NULL;

DROP INDEX IF EXISTS "users_email_key";

CREATE UNIQUE INDEX "users_tenant_id_email_key" ON "users"("tenant_id", "email");
CREATE INDEX "users_tenant_id_role_is_active_idx" ON "users"("tenant_id", "role", "is_active");

ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Inquiry: tenant_id
ALTER TABLE "inquiries" ADD COLUMN "tenant_id" TEXT;

UPDATE "inquiries" i
SET "tenant_id" = u."tenant_id"
FROM "users" u
WHERE i."created_by_id" = u."id" AND i."tenant_id" IS NULL;

UPDATE "inquiries" i
SET "tenant_id" = u."tenant_id"
FROM "order_forms" o
JOIN "users" u ON u."id" = o."created_by_id"
WHERE i."order_form_id" = o."id" AND i."tenant_id" IS NULL;

UPDATE "inquiries"
SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001'
WHERE "tenant_id" IS NULL;

ALTER TABLE "inquiries" ALTER COLUMN "tenant_id" SET NOT NULL;

DROP INDEX IF EXISTS "inquiries_inquiry_number_key";

CREATE UNIQUE INDEX "inquiries_tenant_id_inquiry_number_key" ON "inquiries"("tenant_id", "inquiry_number");
CREATE INDEX "inquiries_tenant_id_created_at_idx" ON "inquiries"("tenant_id", "created_at");

ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Mark legacy admin as tenant owner
UPDATE "users" SET "is_tenant_owner" = true WHERE "email" IN ('admin', 'pyo');
