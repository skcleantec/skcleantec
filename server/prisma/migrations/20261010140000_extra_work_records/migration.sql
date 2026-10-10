-- 추가 시공 현장 기록과 인센티브 비율 스냅샷. 접수 잔금·팀장 추가결재와 별도.

DO $$ BEGIN
  CREATE TYPE "ExtraWorkOverrideSource" AS ENUM ('NONE', 'COMPANY', 'MARKETER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "parent_marketer_id" TEXT;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "extra_work_company_bps" INTEGER;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "extra_work_team_leader_bps" INTEGER;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "extra_work_marketer_bps" INTEGER;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "extra_work_override_source" "ExtraWorkOverrideSource";
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "extra_work_override_bps" INTEGER;

DO $$ BEGIN
  ALTER TABLE "users"
    ADD CONSTRAINT "users_parent_marketer_id_fkey"
    FOREIGN KEY ("parent_marketer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "users_tenant_id_parent_marketer_id_idx" ON "users"("tenant_id", "parent_marketer_id");

CREATE TABLE IF NOT EXISTS "tenant_extra_work_settings" (
  "tenant_id" TEXT NOT NULL,
  "company_bps" INTEGER NOT NULL DEFAULT 10000,
  "team_leader_bps" INTEGER NOT NULL DEFAULT 0,
  "marketer_bps" INTEGER NOT NULL DEFAULT 0,
  "work_presets" JSONB NOT NULL DEFAULT '[]',
  "allow_training" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_extra_work_settings_pkey" PRIMARY KEY ("tenant_id")
);

DO $$ BEGIN
  ALTER TABLE "tenant_extra_work_settings"
    ADD CONSTRAINT "tenant_extra_work_settings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "extra_work_records" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "inquiry_id" TEXT NOT NULL,
  "marketer_id" TEXT NOT NULL,
  "occurred_at" TIMESTAMP(3) NOT NULL,
  "amount_won" INTEGER NOT NULL,
  "work_label" VARCHAR(200) NOT NULL,
  "area_label" VARCHAR(40),
  "company_bps" INTEGER NOT NULL,
  "team_leader_bps" INTEGER NOT NULL,
  "marketer_bps" INTEGER NOT NULL,
  "override_source" "ExtraWorkOverrideSource" NOT NULL,
  "override_bps" INTEGER NOT NULL DEFAULT 0,
  "parent_marketer_id" TEXT,
  "company_won" INTEGER NOT NULL,
  "team_leader_won" INTEGER NOT NULL,
  "marketer_won" INTEGER NOT NULL,
  "parent_won" INTEGER NOT NULL,
  "created_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "extra_work_records_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "extra_work_records"
    ADD CONSTRAINT "extra_work_records_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "extra_work_records"
    ADD CONSTRAINT "extra_work_records_inquiry_id_fkey"
    FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "extra_work_records"
    ADD CONSTRAINT "extra_work_records_marketer_id_fkey"
    FOREIGN KEY ("marketer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "extra_work_records"
    ADD CONSTRAINT "extra_work_records_parent_marketer_id_fkey"
    FOREIGN KEY ("parent_marketer_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "extra_work_records"
    ADD CONSTRAINT "extra_work_records_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "extra_work_records_tenant_id_occurred_at_idx" ON "extra_work_records"("tenant_id", "occurred_at");
CREATE INDEX IF NOT EXISTS "extra_work_records_tenant_id_inquiry_id_idx" ON "extra_work_records"("tenant_id", "inquiry_id");
CREATE INDEX IF NOT EXISTS "extra_work_records_tenant_id_marketer_id_idx" ON "extra_work_records"("tenant_id", "marketer_id");

CREATE TABLE IF NOT EXISTS "extra_work_photos" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "record_id" TEXT NOT NULL,
  "storage_key" VARCHAR(512) NOT NULL,
  "url" VARCHAR(1024) NOT NULL,
  "uploaded_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "extra_work_photos_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "extra_work_photos"
    ADD CONSTRAINT "extra_work_photos_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "extra_work_photos"
    ADD CONSTRAINT "extra_work_photos_record_id_fkey"
    FOREIGN KEY ("record_id") REFERENCES "extra_work_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "extra_work_photos"
    ADD CONSTRAINT "extra_work_photos_uploaded_by_id_fkey"
    FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS "extra_work_photos_tenant_id_record_id_idx" ON "extra_work_photos"("tenant_id", "record_id");

CREATE TABLE IF NOT EXISTS "extra_work_leader_shares" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "record_id" TEXT NOT NULL,
  "team_leader_id" TEXT NOT NULL,
  "amount_won" INTEGER NOT NULL,
  CONSTRAINT "extra_work_leader_shares_pkey" PRIMARY KEY ("id")
);

DO $$ BEGIN
  ALTER TABLE "extra_work_leader_shares"
    ADD CONSTRAINT "extra_work_leader_shares_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "extra_work_leader_shares"
    ADD CONSTRAINT "extra_work_leader_shares_record_id_fkey"
    FOREIGN KEY ("record_id") REFERENCES "extra_work_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "extra_work_leader_shares"
    ADD CONSTRAINT "extra_work_leader_shares_team_leader_id_fkey"
    FOREIGN KEY ("team_leader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "extra_work_leader_shares_record_id_team_leader_id_key" ON "extra_work_leader_shares"("record_id", "team_leader_id");
CREATE INDEX IF NOT EXISTS "extra_work_leader_shares_tenant_id_team_leader_id_idx" ON "extra_work_leader_shares"("tenant_id", "team_leader_id");
