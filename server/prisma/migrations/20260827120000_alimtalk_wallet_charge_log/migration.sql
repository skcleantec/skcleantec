-- CreateTable
CREATE TABLE "alimtalk_wallet_charge_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "amount_krw" INTEGER NOT NULL,
    "balance_after_krw" INTEGER NOT NULL,
    "memo" TEXT,
    "actor_platform_user_id" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alimtalk_wallet_charge_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alimtalk_wallet_charge_logs_tenant_id_created_at_idx" ON "alimtalk_wallet_charge_logs"("tenant_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "alimtalk_wallet_charge_logs" ADD CONSTRAINT "alimtalk_wallet_charge_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
