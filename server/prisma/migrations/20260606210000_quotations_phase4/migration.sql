-- AlterTable
ALTER TABLE "quotation_config" ADD COLUMN "default_email_subject" VARCHAR(200);
ALTER TABLE "quotation_config" ADD COLUMN "default_email_body" TEXT;

-- AlterTable
ALTER TABLE "quotations" ADD COLUMN "last_emailed_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "quotation_email_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "to" VARCHAR(254) NOT NULL,
    "subject" VARCHAR(500) NOT NULL,
    "body_preview" TEXT,
    "sent_by_id" TEXT,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "error_message" VARCHAR(500),

    CONSTRAINT "quotation_email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "quotation_email_logs_tenant_id_quotation_id_sent_at_idx" ON "quotation_email_logs"("tenant_id", "quotation_id", "sent_at");

-- AddForeignKey
ALTER TABLE "quotation_email_logs" ADD CONSTRAINT "quotation_email_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_email_logs" ADD CONSTRAINT "quotation_email_logs_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_email_logs" ADD CONSTRAINT "quotation_email_logs_sent_by_id_fkey" FOREIGN KEY ("sent_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill last_emailed_at from existing sent_at
UPDATE "quotations" SET "last_emailed_at" = "sent_at" WHERE "sent_at" IS NOT NULL AND "last_emailed_at" IS NULL;
