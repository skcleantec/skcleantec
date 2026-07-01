-- CreateTable
CREATE TABLE "telecrm_call_sessions" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "direction" VARCHAR(16) NOT NULL,
    "started_at" TIMESTAMP(3),
    "ended_at" TIMESTAMP(3),
    "duration_sec" INTEGER,
    "customer_match" VARCHAR(16),
    "inquiry_id" TEXT,
    "memo" TEXT,
    "android_call_log_id" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telecrm_call_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telecrm_call_sessions_tenant_id_user_id_created_at_idx" ON "telecrm_call_sessions"("tenant_id", "user_id", "created_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "telecrm_call_sessions_tenant_id_user_id_android_call_log_id_key" ON "telecrm_call_sessions"("tenant_id", "user_id", "android_call_log_id");

-- AddForeignKey
ALTER TABLE "telecrm_call_sessions" ADD CONSTRAINT "telecrm_call_sessions_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_call_sessions" ADD CONSTRAINT "telecrm_call_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_call_sessions" ADD CONSTRAINT "telecrm_call_sessions_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
