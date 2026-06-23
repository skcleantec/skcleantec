-- Phase 5: DB 마켓 만료(EXPIRED) + 플랫폼 중지 타임스탬프

DO $$ BEGIN
  ALTER TYPE "InquiryDbListingStatus" ADD VALUE 'EXPIRED';
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "inquiry_db_listings"
  ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "expired_at" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "platform_suspended_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "inquiry_db_listings_status_expires_at_idx"
  ON "inquiry_db_listings" ("status", "expires_at");

CREATE INDEX IF NOT EXISTS "inquiry_db_listings_platform_suspended_at_idx"
  ON "inquiry_db_listings" ("platform_suspended_at");
