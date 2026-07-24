-- DB 마켓 재판매 체인 · 수수료 원장 · 히스토리

CREATE TYPE "InquiryDbListingFeeLedgerStatus" AS ENUM ('ACTIVE', 'REVERSED');

CREATE TYPE "InquiryDbListingEventType" AS ENUM (
  'HANDOVER_CONFIRMED',
  'COMPLETE_RECALL',
  'CART_RECALL',
  'STEP_COMPLETE_RECALL',
  'STEP_CART_RECALL',
  'DOWNSTREAM_REVERSED',
  'RESALE_DRAFT_CREATED'
);

ALTER TABLE "inquiry_db_listings"
  ADD COLUMN IF NOT EXISTS "parent_listing_id" TEXT,
  ADD COLUMN IF NOT EXISTS "root_listing_id" TEXT,
  ADD COLUMN IF NOT EXISTS "hop_index" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "root_tenant_id" TEXT,
  ADD COLUMN IF NOT EXISTS "deal_balance_amount" INTEGER,
  ADD COLUMN IF NOT EXISTS "superseded_at" TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS "inquiry_db_listings_parent_listing_id_idx"
  ON "inquiry_db_listings"("parent_listing_id");
CREATE INDEX IF NOT EXISTS "inquiry_db_listings_root_listing_id_idx"
  ON "inquiry_db_listings"("root_listing_id");
CREATE INDEX IF NOT EXISTS "inquiry_db_listings_root_tenant_id_idx"
  ON "inquiry_db_listings"("root_tenant_id");

ALTER TABLE "inquiry_db_listings"
  ADD CONSTRAINT "inquiry_db_listings_parent_listing_id_fkey"
  FOREIGN KEY ("parent_listing_id") REFERENCES "inquiry_db_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inquiry_db_listings"
  ADD CONSTRAINT "inquiry_db_listings_root_listing_id_fkey"
  FOREIGN KEY ("root_listing_id") REFERENCES "inquiry_db_listings"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "inquiry_db_listings"
  ADD CONSTRAINT "inquiry_db_listings_root_tenant_id_fkey"
  FOREIGN KEY ("root_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- 기존 listing 백필 (hop 0)
UPDATE "inquiry_db_listings" l
SET
  "hop_index" = 0,
  "root_tenant_id" = l."tenant_id",
  "root_listing_id" = l."id",
  "deal_balance_amount" = COALESCE(
    l."deal_balance_amount",
    l."display_amount" + l."listing_fee",
    (SELECT i."service_balance_amount" FROM "inquiries" i WHERE i."id" = l."inquiry_id")
  )
WHERE l."root_listing_id" IS NULL;

CREATE TABLE "inquiry_db_listing_fee_ledgers" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "listing_id" TEXT NOT NULL,
  "hop_index" INTEGER NOT NULL,
  "seller_tenant_id" TEXT NOT NULL,
  "buyer_tenant_id" TEXT,
  "buyer_external_company_id" TEXT,
  "fee_amount" INTEGER NOT NULL,
  "status" "InquiryDbListingFeeLedgerStatus" NOT NULL DEFAULT 'ACTIVE',
  "confirmed_at" TIMESTAMPTZ NOT NULL,
  "reversed_at" TIMESTAMPTZ,
  "reversed_by_user_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inquiry_db_listing_fee_ledgers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inquiry_db_listing_fee_ledgers_tenant_id_listing_id_idx"
  ON "inquiry_db_listing_fee_ledgers"("tenant_id", "listing_id");
CREATE INDEX "inquiry_db_listing_fee_ledgers_listing_id_status_idx"
  ON "inquiry_db_listing_fee_ledgers"("listing_id", "status");
CREATE INDEX "inquiry_db_listing_fee_ledgers_seller_tenant_id_buyer_tenant_id_idx"
  ON "inquiry_db_listing_fee_ledgers"("seller_tenant_id", "buyer_tenant_id");

ALTER TABLE "inquiry_db_listing_fee_ledgers"
  ADD CONSTRAINT "inquiry_db_listing_fee_ledgers_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inquiry_db_listing_fee_ledgers"
  ADD CONSTRAINT "inquiry_db_listing_fee_ledgers_listing_id_fkey"
  FOREIGN KEY ("listing_id") REFERENCES "inquiry_db_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inquiry_db_listing_fee_ledgers"
  ADD CONSTRAINT "inquiry_db_listing_fee_ledgers_buyer_tenant_id_fkey"
  FOREIGN KEY ("buyer_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inquiry_db_listing_fee_ledgers"
  ADD CONSTRAINT "inquiry_db_listing_fee_ledgers_buyer_external_company_id_fkey"
  FOREIGN KEY ("buyer_external_company_id") REFERENCES "external_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "inquiry_db_listing_fee_ledgers"
  ADD CONSTRAINT "inquiry_db_listing_fee_ledgers_reversed_by_user_id_fkey"
  FOREIGN KEY ("reversed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "inquiry_db_listing_events" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "listing_id" TEXT NOT NULL,
  "event_type" "InquiryDbListingEventType" NOT NULL,
  "hop_index" INTEGER NOT NULL DEFAULT 0,
  "actor_user_id" TEXT,
  "payload" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inquiry_db_listing_events_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inquiry_db_listing_events_listing_id_created_at_idx"
  ON "inquiry_db_listing_events"("listing_id", "created_at");
CREATE INDEX "inquiry_db_listing_events_tenant_id_listing_id_idx"
  ON "inquiry_db_listing_events"("tenant_id", "listing_id");

ALTER TABLE "inquiry_db_listing_events"
  ADD CONSTRAINT "inquiry_db_listing_events_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inquiry_db_listing_events"
  ADD CONSTRAINT "inquiry_db_listing_events_listing_id_fkey"
  FOREIGN KEY ("listing_id") REFERENCES "inquiry_db_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "inquiry_db_listing_events"
  ADD CONSTRAINT "inquiry_db_listing_events_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
