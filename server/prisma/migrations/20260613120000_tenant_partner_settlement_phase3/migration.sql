-- CreateEnum
CREATE TYPE "TenantPartnerSettlementRole" AS ENUM ('SELLER', 'BUYER');

-- CreateTable
CREATE TABLE "tenant_partner_settlement_payments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "partner_tenant_id" TEXT NOT NULL,
    "partnership_id" TEXT,
    "role" "TenantPartnerSettlementRole" NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "memo" TEXT,
    "actor_id" TEXT,

    CONSTRAINT "tenant_partner_settlement_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tenant_partner_settlement_resets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "partner_tenant_id" TEXT NOT NULL,
    "partnership_id" TEXT,
    "role" "TenantPartnerSettlementRole" NOT NULL,
    "reset_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,

    CONSTRAINT "tenant_partner_settlement_resets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "tenant_partner_settlement_payments_tenant_id_role_partner_te_idx" ON "tenant_partner_settlement_payments"("tenant_id", "role", "partner_tenant_id", "paid_at");

-- CreateIndex
CREATE INDEX "tenant_partner_settlement_resets_tenant_id_role_partner_ten_idx" ON "tenant_partner_settlement_resets"("tenant_id", "role", "partner_tenant_id", "reset_at");

-- AddForeignKey
ALTER TABLE "tenant_partner_settlement_payments" ADD CONSTRAINT "tenant_partner_settlement_payments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_partner_settlement_payments" ADD CONSTRAINT "tenant_partner_settlement_payments_partnership_id_fkey" FOREIGN KEY ("partnership_id") REFERENCES "tenant_partnerships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_partner_settlement_payments" ADD CONSTRAINT "tenant_partner_settlement_payments_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_partner_settlement_resets" ADD CONSTRAINT "tenant_partner_settlement_resets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_partner_settlement_resets" ADD CONSTRAINT "tenant_partner_settlement_resets_partnership_id_fkey" FOREIGN KEY ("partnership_id") REFERENCES "tenant_partnerships"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tenant_partner_settlement_resets" ADD CONSTRAINT "tenant_partner_settlement_resets_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
