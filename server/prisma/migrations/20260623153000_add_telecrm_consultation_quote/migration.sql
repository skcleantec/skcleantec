-- CreateEnum
CREATE TYPE "TelecrmConsultationQuoteStatus" AS ENUM ('DRAFT', 'QUOTED', 'ORDER_ISSUED', 'SUPERSEDED');

-- CreateTable
CREATE TABLE "telecrm_consultation_quotes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "status" "TelecrmConsultationQuoteStatus" NOT NULL DEFAULT 'DRAFT',
    "payload" JSONB NOT NULL,
    "followup_id" TEXT,
    "inquiry_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "updated_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telecrm_consultation_quotes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telecrm_consultation_quotes_tenant_id_phone_updated_at_idx" ON "telecrm_consultation_quotes"("tenant_id", "phone", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "telecrm_consultation_quotes_tenant_id_status_phone_idx" ON "telecrm_consultation_quotes"("tenant_id", "status", "phone");

-- CreateIndex
CREATE INDEX "telecrm_consultation_quotes_tenant_id_followup_id_idx" ON "telecrm_consultation_quotes"("tenant_id", "followup_id");

-- CreateIndex
CREATE INDEX "telecrm_consultation_quotes_tenant_id_inquiry_id_idx" ON "telecrm_consultation_quotes"("tenant_id", "inquiry_id");

-- AddForeignKey
ALTER TABLE "telecrm_consultation_quotes" ADD CONSTRAINT "telecrm_consultation_quotes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_consultation_quotes" ADD CONSTRAINT "telecrm_consultation_quotes_followup_id_fkey" FOREIGN KEY ("followup_id") REFERENCES "order_followups"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_consultation_quotes" ADD CONSTRAINT "telecrm_consultation_quotes_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_consultation_quotes" ADD CONSTRAINT "telecrm_consultation_quotes_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_consultation_quotes" ADD CONSTRAINT "telecrm_consultation_quotes_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
