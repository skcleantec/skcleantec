-- Phase 10: DB 마켓(정보공유) 구매 전 문의(Q&A)

DO $$ BEGIN
  CREATE TYPE "InquiryDbListingMessageAuthorRole" AS ENUM ('SELLER', 'BUYER');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "inquiry_db_listing_messages" (
  "id"              TEXT NOT NULL,
  "tenant_id"       TEXT NOT NULL,
  "listing_id"      TEXT NOT NULL,
  "author_user_id"  TEXT NOT NULL,
  "author_role"     "InquiryDbListingMessageAuthorRole" NOT NULL,
  "body"            TEXT NOT NULL,
  "created_at"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inquiry_db_listing_messages_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inquiry_db_listing_messages_listing_id_created_at_idx"
  ON "inquiry_db_listing_messages"("listing_id", "created_at");
CREATE INDEX IF NOT EXISTS "inquiry_db_listing_messages_tenant_id_listing_id_idx"
  ON "inquiry_db_listing_messages"("tenant_id", "listing_id");

DO $$ BEGIN
  ALTER TABLE "inquiry_db_listing_messages"
    ADD CONSTRAINT "inquiry_db_listing_messages_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inquiry_db_listing_messages"
    ADD CONSTRAINT "inquiry_db_listing_messages_listing_id_fkey"
    FOREIGN KEY ("listing_id") REFERENCES "inquiry_db_listings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "inquiry_db_listing_messages"
    ADD CONSTRAINT "inquiry_db_listing_messages_author_user_id_fkey"
    FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
