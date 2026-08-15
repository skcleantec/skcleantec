-- CreateTable
CREATE TABLE "telecrm_ai_usage_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chat_id" VARCHAR(64),
    "inquiry_id" TEXT,
    "source" VARCHAR(20) NOT NULL,
    "model" VARCHAR(64) NOT NULL,
    "prompt_tokens" INTEGER NOT NULL,
    "completion_tokens" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telecrm_ai_usage_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telecrm_ai_summaries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "chat_id" VARCHAR(64) NOT NULL,
    "inquiry_id" TEXT,
    "content_hash" VARCHAR(128),
    "summary" TEXT NOT NULL,
    "payload_json" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telecrm_ai_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telecrm_ai_usage_logs_tenant_id_created_at_idx" ON "telecrm_ai_usage_logs"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "telecrm_ai_usage_logs_tenant_id_user_id_created_at_idx" ON "telecrm_ai_usage_logs"("tenant_id", "user_id", "created_at");

-- CreateIndex
CREATE INDEX "telecrm_ai_summaries_tenant_id_inquiry_id_idx" ON "telecrm_ai_summaries"("tenant_id", "inquiry_id");

-- CreateIndex
CREATE UNIQUE INDEX "telecrm_ai_summaries_tenant_id_chat_id_content_hash_key" ON "telecrm_ai_summaries"("tenant_id", "chat_id", "content_hash");

-- AddForeignKey
ALTER TABLE "telecrm_ai_usage_logs" ADD CONSTRAINT "telecrm_ai_usage_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_ai_usage_logs" ADD CONSTRAINT "telecrm_ai_usage_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_ai_usage_logs" ADD CONSTRAINT "telecrm_ai_usage_logs_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_ai_summaries" ADD CONSTRAINT "telecrm_ai_summaries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_ai_summaries" ADD CONSTRAINT "telecrm_ai_summaries_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_ai_summaries" ADD CONSTRAINT "telecrm_ai_summaries_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
