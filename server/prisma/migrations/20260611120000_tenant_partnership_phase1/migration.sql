-- Phase 1: 테넌트 간 DB 거래 — 파트너십(초대·상호 승인)만. 전달·정산·동기화는 후속 Phase.

DO $$ BEGIN
  CREATE TYPE "TenantPartnershipStatus" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'REJECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "TenantPartnershipSuspendedBy" AS ENUM ('PLATFORM', 'TENANT_LOW', 'TENANT_HIGH');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "tenant_partnerships" (
  "id"                    TEXT NOT NULL,
  "tenant_low_id"         TEXT NOT NULL,
  "tenant_high_id"        TEXT NOT NULL,
  "status"                "TenantPartnershipStatus" NOT NULL DEFAULT 'PENDING',
  "requested_by_tenant_id" TEXT NOT NULL,
  "low_accepted_at"       TIMESTAMP(3),
  "high_accepted_at"      TIMESTAMP(3),
  "suspended_at"          TIMESTAMP(3),
  "suspended_by"          "TenantPartnershipSuspendedBy",
  "memo"                  TEXT,
  "created_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_partnerships_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_partnerships_tenant_low_id_tenant_high_id_key"
  ON "tenant_partnerships"("tenant_low_id", "tenant_high_id");
CREATE INDEX IF NOT EXISTS "tenant_partnerships_tenant_low_id_status_idx"
  ON "tenant_partnerships"("tenant_low_id", "status");
CREATE INDEX IF NOT EXISTS "tenant_partnerships_tenant_high_id_status_idx"
  ON "tenant_partnerships"("tenant_high_id", "status");

DO $$ BEGIN
  ALTER TABLE "tenant_partnerships" ADD CONSTRAINT "tenant_partnerships_tenant_low_id_fkey"
    FOREIGN KEY ("tenant_low_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "tenant_partnerships" ADD CONSTRAINT "tenant_partnerships_tenant_high_id_fkey"
    FOREIGN KEY ("tenant_high_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "tenant_partnerships" ADD CONSTRAINT "tenant_partnerships_requested_by_tenant_id_fkey"
    FOREIGN KEY ("requested_by_tenant_id") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
