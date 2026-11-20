-- 텔레CRM 대응 카드 · 검색 기록
CREATE TABLE IF NOT EXISTS "telecrm_response_cards" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "operating_company_id" TEXT,
    "code" VARCHAR(16) NOT NULL,
    "category" VARCHAR(40) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "triggers" JSONB NOT NULL,
    "intent" TEXT NOT NULL,
    "responses" JSONB NOT NULL,
    "avoid" JSONB NOT NULL,
    "rule" TEXT NOT NULL DEFAULT '',
    "sources" JSONB NOT NULL,
    "won_in_call" BOOLEAN NOT NULL DEFAULT false,
    "status" VARCHAR(16) NOT NULL DEFAULT 'draft',
    "embedding" JSONB,
    "use_count" INTEGER NOT NULL DEFAULT 0,
    "up_count" INTEGER NOT NULL DEFAULT 0,
    "down_count" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "approved_by_id" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "telecrm_response_cards_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "telecrm_response_cards_tenant_id_code_key"
  ON "telecrm_response_cards"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "telecrm_response_cards_tenant_id_status_idx"
  ON "telecrm_response_cards"("tenant_id", "status");
CREATE INDEX IF NOT EXISTS "telecrm_response_cards_tenant_id_operating_company_id_status_idx"
  ON "telecrm_response_cards"("tenant_id", "operating_company_id", "status");

DO $$ BEGIN
  ALTER TABLE "telecrm_response_cards"
    ADD CONSTRAINT "telecrm_response_cards_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "telecrm_response_cards"
    ADD CONSTRAINT "telecrm_response_cards_operating_company_id_fkey"
    FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "telecrm_response_cards"
    ADD CONSTRAINT "telecrm_response_cards_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "telecrm_response_cards"
    ADD CONSTRAINT "telecrm_response_cards_approved_by_id_fkey"
    FOREIGN KEY ("approved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "telecrm_response_search_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "q" VARCHAR(300) NOT NULL,
    "result_count" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telecrm_response_search_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "telecrm_response_search_logs_tenant_id_created_at_idx"
  ON "telecrm_response_search_logs"("tenant_id", "created_at");
CREATE INDEX IF NOT EXISTS "telecrm_response_search_logs_tenant_id_result_count_created_at_idx"
  ON "telecrm_response_search_logs"("tenant_id", "result_count", "created_at");

DO $$ BEGIN
  ALTER TABLE "telecrm_response_search_logs"
    ADD CONSTRAINT "telecrm_response_search_logs_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "telecrm_response_search_logs"
    ADD CONSTRAINT "telecrm_response_search_logs_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
