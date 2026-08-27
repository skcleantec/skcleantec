-- CreateTable
CREATE TABLE "alimtalk_charge_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "amount_krw" INTEGER NOT NULL,
    "memo" TEXT,
    "status" VARCHAR(16) NOT NULL,
    "requested_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "actor_platform_user_id" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alimtalk_charge_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alimtalk_charge_requests_tenant_id_status_created_at_idx" ON "alimtalk_charge_requests"("tenant_id", "status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "alimtalk_charge_requests" ADD CONSTRAINT "alimtalk_charge_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
