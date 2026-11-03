-- 텔레CRM AI 견적 — 말로 넣은 가격 규칙
CREATE TABLE IF NOT EXISTS "telecrm_ai_quote_rules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "spec" JSONB NOT NULL,
    "summary" VARCHAR(200) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "created_by_name" VARCHAR(120),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "telecrm_ai_quote_rules_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "telecrm_ai_quote_rules_tenant_id_sort_order_idx" ON "telecrm_ai_quote_rules"("tenant_id", "sort_order");

DO $$ BEGIN
  ALTER TABLE "telecrm_ai_quote_rules"
    ADD CONSTRAINT "telecrm_ai_quote_rules_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
