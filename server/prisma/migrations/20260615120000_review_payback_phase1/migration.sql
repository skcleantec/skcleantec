-- CreateEnum
CREATE TYPE "ReviewPaybackStatus" AS ENUM ('PENDING', 'VERIFIED', 'PAID', 'REJECTED');

-- AlterTable
ALTER TABLE "order_forms" ADD COLUMN "review_payback_token" TEXT;

-- CreateTable
CREATE TABLE "review_payback_requests" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_form_id" TEXT NOT NULL,
    "inquiry_id" TEXT,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT,
    "bank_name" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "review_image_url" VARCHAR(1024) NOT NULL,
    "review_image_public_id" VARCHAR(512),
    "status" "ReviewPaybackStatus" NOT NULL DEFAULT 'PENDING',
    "admin_memo" TEXT,
    "handled_by_id" TEXT,
    "seen_at" TIMESTAMP(3),
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_payback_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_forms_review_payback_token_key" ON "order_forms"("review_payback_token");

-- CreateIndex
CREATE UNIQUE INDEX "review_payback_requests_order_form_id_key" ON "review_payback_requests"("order_form_id");

-- CreateIndex
CREATE INDEX "review_payback_requests_tenant_id_status_submitted_at_idx" ON "review_payback_requests"("tenant_id", "status", "submitted_at" DESC);

-- CreateIndex
CREATE INDEX "review_payback_requests_tenant_id_seen_at_status_idx" ON "review_payback_requests"("tenant_id", "seen_at", "status");

-- AddForeignKey
ALTER TABLE "review_payback_requests" ADD CONSTRAINT "review_payback_requests_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_payback_requests" ADD CONSTRAINT "review_payback_requests_order_form_id_fkey" FOREIGN KEY ("order_form_id") REFERENCES "order_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_payback_requests" ADD CONSTRAINT "review_payback_requests_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_payback_requests" ADD CONSTRAINT "review_payback_requests_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
