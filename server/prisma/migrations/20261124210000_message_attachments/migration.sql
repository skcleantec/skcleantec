-- 메시지 사진·PDF. 기존 메시지 내용은 그대로 둔다. content 빈 문자열은 원래부터 허용된다.
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "attachments_viewed_at" TIMESTAMP(3);
ALTER TABLE "crew_staff_notices" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMP(3);
ALTER TABLE "crew_staff_notices" ADD COLUMN IF NOT EXISTS "attachments_viewed_at" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "message_attachments" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "uploader_id" TEXT NOT NULL,
  "kind" VARCHAR(8) NOT NULL,
  "file_name" VARCHAR(255) NOT NULL,
  "size_bytes" INTEGER NOT NULL,
  "width" INTEGER,
  "height" INTEGER,
  "page_count" INTEGER,
  "original_url" VARCHAR(2048) NOT NULL,
  "preview_url" VARCHAR(2048),
  "thumb_url" VARCHAR(2048),
  "storage_key" VARCHAR(2048) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "message_attachments_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "message_attachment_links" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "attachment_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "batch_id" VARCHAR(64),
  "message_id" TEXT,
  "crew_notice_batch_id" VARCHAR(64),
  CONSTRAINT "message_attachment_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "message_attachment_links_one_target" CHECK (
    (CASE WHEN "batch_id" IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN "message_id" IS NOT NULL THEN 1 ELSE 0 END)
    + (CASE WHEN "crew_notice_batch_id" IS NOT NULL THEN 1 ELSE 0 END) = 1
  )
);

CREATE TABLE IF NOT EXISTS "message_notice_reminds" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "batch_id" VARCHAR(64) NOT NULL,
  "reminded_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "message_notice_reminds_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "message_attachments_tenant_id_created_at_idx" ON "message_attachments"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "message_attachment_links_tenant_id_batch_id_idx" ON "message_attachment_links"("tenant_id", "batch_id");
CREATE INDEX IF NOT EXISTS "message_attachment_links_tenant_id_message_id_idx" ON "message_attachment_links"("tenant_id", "message_id");
CREATE INDEX IF NOT EXISTS "message_attachment_links_tenant_id_crew_notice_batch_id_idx" ON "message_attachment_links"("tenant_id", "crew_notice_batch_id");
CREATE INDEX IF NOT EXISTS "message_attachment_links_attachment_id_idx" ON "message_attachment_links"("attachment_id");
CREATE UNIQUE INDEX IF NOT EXISTS "message_notice_reminds_tenant_id_batch_id_key" ON "message_notice_reminds"("tenant_id", "batch_id");

DO $$ BEGIN
  ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "message_attachments" ADD CONSTRAINT "message_attachments_uploader_id_fkey"
    FOREIGN KEY ("uploader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "message_attachment_links" ADD CONSTRAINT "message_attachment_links_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "message_attachment_links" ADD CONSTRAINT "message_attachment_links_attachment_id_fkey"
    FOREIGN KEY ("attachment_id") REFERENCES "message_attachments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "message_attachment_links" ADD CONSTRAINT "message_attachment_links_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "messages"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "message_notice_reminds" ADD CONSTRAINT "message_notice_reminds_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
