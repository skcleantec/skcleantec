-- Allow multiple share rows per source inquiry (REVOKED history + new ACTIVE relist).
-- Enforce at most one ACTIVE share per source inquiry.

DROP INDEX IF EXISTS "tenant_inquiry_shares_source_inquiry_id_key";

CREATE UNIQUE INDEX "tenant_inquiry_shares_source_inquiry_id_active_key"
  ON "tenant_inquiry_shares" ("source_inquiry_id")
  WHERE "sync_status" = 'ACTIVE';

CREATE INDEX "tenant_inquiry_shares_source_inquiry_id_sync_status_idx"
  ON "tenant_inquiry_shares" ("source_inquiry_id", "sync_status");
