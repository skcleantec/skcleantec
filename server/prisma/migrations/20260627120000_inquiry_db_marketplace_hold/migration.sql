-- Phase 11: DB 마켓(정보공유) 구매 전 검토 예약(hold)

ALTER TABLE "inquiry_db_listings"
  ADD COLUMN IF NOT EXISTS "hold_buyer_kind" "InquiryDbListingBuyerKind",
  ADD COLUMN IF NOT EXISTS "hold_buyer_tenant_id" TEXT,
  ADD COLUMN IF NOT EXISTS "hold_buyer_external_company_id" TEXT,
  ADD COLUMN IF NOT EXISTS "hold_by_user_id" TEXT,
  ADD COLUMN IF NOT EXISTS "held_until" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "inquiry_db_listings_status_held_until_idx"
  ON "inquiry_db_listings"("status", "held_until");

DO $$ BEGIN
  ALTER TABLE "inquiry_db_listings"
    ADD CONSTRAINT "inquiry_db_listings_hold_buyer_tenant_id_fkey"
    FOREIGN KEY ("hold_buyer_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inquiry_db_listings"
    ADD CONSTRAINT "inquiry_db_listings_hold_buyer_external_company_id_fkey"
    FOREIGN KEY ("hold_buyer_external_company_id") REFERENCES "external_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inquiry_db_listings"
    ADD CONSTRAINT "inquiry_db_listings_hold_by_user_id_fkey"
    FOREIGN KEY ("hold_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
