-- AlterTable: telecrm AI usage — product key + estimated cost
ALTER TABLE "telecrm_ai_usage_logs" ADD COLUMN "product_key" VARCHAR(32) NOT NULL DEFAULT 'telecrm_summary';
ALTER TABLE "telecrm_ai_usage_logs" ADD COLUMN "estimated_cost_usd_micros" INTEGER NOT NULL DEFAULT 0;

-- CreateTable: quick paste AI usage
CREATE TABLE "quick_paste_ai_usage_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT,
    "inquiry_id" TEXT,
    "operation" VARCHAR(32) NOT NULL DEFAULT 'understand',
    "model" VARCHAR(64) NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "completion_tokens" INTEGER NOT NULL,
    "estimated_cost_usd_micros" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quick_paste_ai_usage_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "quick_paste_ai_usage_logs_tenant_id_created_at_idx" ON "quick_paste_ai_usage_logs"("tenant_id", "created_at");
CREATE INDEX "quick_paste_ai_usage_logs_tenant_id_user_id_created_at_idx" ON "quick_paste_ai_usage_logs"("tenant_id", "user_id", "created_at");

ALTER TABLE "quick_paste_ai_usage_logs" ADD CONSTRAINT "quick_paste_ai_usage_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "quick_paste_ai_usage_logs" ADD CONSTRAINT "quick_paste_ai_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "quick_paste_ai_usage_logs" ADD CONSTRAINT "quick_paste_ai_usage_logs_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
