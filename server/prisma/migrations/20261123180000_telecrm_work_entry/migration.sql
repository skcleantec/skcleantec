-- 텔레CRM 작업 기록. 고객 원본(부재·접수)과는 문자열로만 연결한다.
CREATE TABLE IF NOT EXISTS "telecrm_work_entries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "operating_company_id" TEXT,
    "user_id" TEXT NOT NULL,
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "source" VARCHAR(32) NOT NULL,
    "nickname" VARCHAR(80),
    "customer_name" VARCHAR(120),
    "contact_phone" VARCHAR(32),
    "safe_phone" VARCHAR(32),
    "actions" JSONB NOT NULL DEFAULT '{}',
    "outcome" VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    "saved_kind" VARCHAR(32),
    "left_by" VARCHAR(16),
    "followup_id" TEXT,
    "inquiry_id" TEXT,
    "draft" JSONB,
    "summary" VARCHAR(200),
    "dismissed_at" TIMESTAMP(3),
    "resumed_at" TIMESTAMP(3),
    CONSTRAINT "telecrm_work_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "telecrm_work_entries_tenant_id_user_id_started_at_idx"
  ON "telecrm_work_entries"("tenant_id", "user_id", "started_at" DESC);
CREATE INDEX IF NOT EXISTS "telecrm_work_entries_tenant_id_outcome_started_at_idx"
  ON "telecrm_work_entries"("tenant_id", "outcome", "started_at" DESC);

DO $$ BEGIN
  ALTER TABLE "telecrm_work_entries"
    ADD CONSTRAINT "telecrm_work_entries_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "telecrm_work_entries"
    ADD CONSTRAINT "telecrm_work_entries_operating_company_id_fkey"
    FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "telecrm_work_entries"
    ADD CONSTRAINT "telecrm_work_entries_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
