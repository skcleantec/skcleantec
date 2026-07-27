-- DB 마켓 순위 노출 (1·2·3순위 워터fall)

CREATE TYPE "InquiryDbListingOfferMode" AS ENUM ('SIMULTANEOUS', 'PRIORITY');

ALTER TYPE "InquiryDbListingEventType" ADD VALUE IF NOT EXISTS 'PRIORITY_ACTIVATED';
ALTER TYPE "InquiryDbListingEventType" ADD VALUE IF NOT EXISTS 'PRIORITY_DECLINED';
ALTER TYPE "InquiryDbListingEventType" ADD VALUE IF NOT EXISTS 'PRIORITY_EXHAUSTED';

ALTER TABLE "inquiry_db_listings"
  ADD COLUMN IF NOT EXISTS "offer_mode" "InquiryDbListingOfferMode",
  ADD COLUMN IF NOT EXISTS "current_priority_rank" INTEGER;

ALTER TABLE "inquiry_db_listing_audiences"
  ADD COLUMN IF NOT EXISTS "priority_rank" INTEGER;

CREATE UNIQUE INDEX IF NOT EXISTS "inquiry_db_listing_audiences_listing_id_priority_rank_key"
  ON "inquiry_db_listing_audiences" ("listing_id", "priority_rank")
  WHERE "priority_rank" IS NOT NULL;
