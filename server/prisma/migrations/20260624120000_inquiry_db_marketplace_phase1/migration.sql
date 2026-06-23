-- Phase 1: DB 마켓(정보공유) — listing·audience 테이블. 양쪽 확정·이동은 Phase 2.

DO $$ BEGIN
  CREATE TYPE "InquiryDbListingStatus" AS ENUM ('DRAFT', 'OPEN', 'PENDING_SELLER', 'CONFIRMED', 'WITHDRAWN');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InquiryDbListingVisibility" AS ENUM ('ALL', 'SELECTED');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InquiryDbListingAudienceKind" AS ENUM ('PARTNER_TENANT', 'EXTERNAL_COMPANY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE "InquiryDbListingBuyerKind" AS ENUM ('PARTNER_TENANT', 'EXTERNAL_COMPANY');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "inquiry_db_listings" (
  "id"                          TEXT NOT NULL,
  "tenant_id"                   TEXT NOT NULL,
  "inquiry_id"                  TEXT NOT NULL,
  "listing_fee"                 INTEGER NOT NULL,
  "display_amount"              INTEGER,
  "status"                      "InquiryDbListingStatus" NOT NULL DEFAULT 'DRAFT',
  "visibility"                  "InquiryDbListingVisibility" NOT NULL DEFAULT 'ALL',
  "published_at"                TIMESTAMP(3),
  "withdrawn_at"                TIMESTAMP(3),
  "confirmed_at"                TIMESTAMP(3),
  "buyer_kind"                  "InquiryDbListingBuyerKind",
  "buyer_tenant_id"             TEXT,
  "buyer_external_company_id"   TEXT,
  "buyer_confirmed_at"          TIMESTAMP(3),
  "seller_confirmed_at"         TIMESTAMP(3),
  "buyer_confirmed_by_user_id"  TEXT,
  "seller_confirmed_by_user_id" TEXT,
  "tenant_inquiry_share_id"     TEXT,
  "created_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inquiry_db_listings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "inquiry_db_listings_inquiry_id_key" ON "inquiry_db_listings"("inquiry_id");
CREATE INDEX IF NOT EXISTS "inquiry_db_listings_tenant_id_status_published_at_idx"
  ON "inquiry_db_listings"("tenant_id", "status", "published_at");
CREATE INDEX IF NOT EXISTS "inquiry_db_listings_status_published_at_idx"
  ON "inquiry_db_listings"("status", "published_at");
CREATE INDEX IF NOT EXISTS "inquiry_db_listings_buyer_tenant_id_status_idx"
  ON "inquiry_db_listings"("buyer_tenant_id", "status");

CREATE TABLE IF NOT EXISTS "inquiry_db_listing_audiences" (
  "id"                    TEXT NOT NULL,
  "listing_id"            TEXT NOT NULL,
  "audience_kind"         "InquiryDbListingAudienceKind" NOT NULL,
  "partner_tenant_id"     TEXT,
  "external_company_id"   TEXT,
  CONSTRAINT "inquiry_db_listing_audiences_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inquiry_db_listing_audiences_listing_id_idx"
  ON "inquiry_db_listing_audiences"("listing_id");
CREATE INDEX IF NOT EXISTS "inquiry_db_listing_audiences_partner_tenant_id_idx"
  ON "inquiry_db_listing_audiences"("partner_tenant_id");
CREATE INDEX IF NOT EXISTS "inquiry_db_listing_audiences_external_company_id_idx"
  ON "inquiry_db_listing_audiences"("external_company_id");

DO $$ BEGIN
  ALTER TABLE "inquiry_db_listings" ADD CONSTRAINT "inquiry_db_listings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inquiry_db_listings" ADD CONSTRAINT "inquiry_db_listings_inquiry_id_fkey"
    FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inquiry_db_listings" ADD CONSTRAINT "inquiry_db_listings_buyer_tenant_id_fkey"
    FOREIGN KEY ("buyer_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inquiry_db_listings" ADD CONSTRAINT "inquiry_db_listings_buyer_external_company_id_fkey"
    FOREIGN KEY ("buyer_external_company_id") REFERENCES "external_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inquiry_db_listing_audiences" ADD CONSTRAINT "inquiry_db_listing_audiences_listing_id_fkey"
    FOREIGN KEY ("listing_id") REFERENCES "inquiry_db_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inquiry_db_listing_audiences" ADD CONSTRAINT "inquiry_db_listing_audiences_partner_tenant_id_fkey"
    FOREIGN KEY ("partner_tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inquiry_db_listing_audiences" ADD CONSTRAINT "inquiry_db_listing_audiences_external_company_id_fkey"
    FOREIGN KEY ("external_company_id") REFERENCES "external_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
