-- 추가 시공 항목(위치·수량·금액)과 항목별 사진.

ALTER TABLE "extra_work_records" ALTER COLUMN "work_label" TYPE VARCHAR(500);

CREATE TABLE IF NOT EXISTS "extra_work_lines" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "record_id" TEXT NOT NULL,
  "sort_order" INTEGER NOT NULL,
  "work_label" VARCHAR(40) NOT NULL,
  "place_label" VARCHAR(40),
  "quantity" INTEGER,
  "unit_label" VARCHAR(8),
  "amount_won" INTEGER NOT NULL,
  CONSTRAINT "extra_work_lines_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "extra_work_lines"
    ADD CONSTRAINT "extra_work_lines_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "extra_work_lines"
    ADD CONSTRAINT "extra_work_lines_record_id_fkey"
    FOREIGN KEY ("record_id") REFERENCES "extra_work_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "extra_work_lines_tenant_id_record_id_idx" ON "extra_work_lines"("tenant_id", "record_id");

ALTER TABLE "extra_work_photos" ADD COLUMN IF NOT EXISTS "line_id" TEXT;

DO $$ BEGIN
  ALTER TABLE "extra_work_photos"
    ADD CONSTRAINT "extra_work_photos_line_id_fkey"
    FOREIGN KEY ("line_id") REFERENCES "extra_work_lines"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "extra_work_photos_tenant_id_line_id_idx" ON "extra_work_photos"("tenant_id", "line_id");
