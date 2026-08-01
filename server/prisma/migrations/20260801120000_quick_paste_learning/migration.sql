-- 빠른등록 Phase 3 — 테넌트 규칙·학습 로그

CREATE TABLE "quick_paste_tenant_rules" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "field_key" VARCHAR(32) NOT NULL,
    "rule_type" VARCHAR(24) NOT NULL,
    "pattern" VARCHAR(512) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "hit_count" INTEGER NOT NULL DEFAULT 0,
    "source" VARCHAR(24) NOT NULL DEFAULT 'learned',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quick_paste_tenant_rules_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "quick_paste_learning_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "inquiry_id" TEXT,
    "text_hash" VARCHAR(64) NOT NULL,
    "text_length" INTEGER NOT NULL,
    "rule_draft" JSONB NOT NULL,
    "preview_draft" JSONB NOT NULL,
    "final_draft" JSONB NOT NULL,
    "missing_after_rule" JSONB NOT NULL DEFAULT '[]',
    "ai_applied" BOOLEAN NOT NULL DEFAULT false,
    "ai_filled_fields" JSONB NOT NULL DEFAULT '[]',
    "user_edited_fields" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quick_paste_learning_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quick_paste_tenant_rules_tenant_id_field_key_sort_order_idx" ON "quick_paste_tenant_rules"("tenant_id", "field_key", "sort_order");

CREATE INDEX "quick_paste_learning_logs_tenant_id_text_hash_idx" ON "quick_paste_learning_logs"("tenant_id", "text_hash");

CREATE INDEX "quick_paste_learning_logs_tenant_id_created_at_idx" ON "quick_paste_learning_logs"("tenant_id", "created_at" DESC);

ALTER TABLE "quick_paste_tenant_rules" ADD CONSTRAINT "quick_paste_tenant_rules_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "quick_paste_learning_logs" ADD CONSTRAINT "quick_paste_learning_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
