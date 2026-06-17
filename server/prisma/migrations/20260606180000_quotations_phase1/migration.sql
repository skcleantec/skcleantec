-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('DRAFT', 'FINALIZED', 'SENT');

-- CreateTable
CREATE TABLE "quotation_service_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "description" VARCHAR(500),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_service_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "quote_number" VARCHAR(32) NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "customer_name" VARCHAR(120) NOT NULL,
    "customer_phone" VARCHAR(32),
    "customer_email" VARCHAR(254),
    "customer_address" VARCHAR(500),
    "memo" VARCHAR(1000),
    "subtotal" INTEGER NOT NULL DEFAULT 0,
    "discount_amount" INTEGER NOT NULL DEFAULT 0,
    "total" INTEGER NOT NULL DEFAULT 0,
    "valid_until" DATE,
    "inquiry_id" TEXT,
    "created_by_id" TEXT,
    "sent_at" TIMESTAMP(3),
    "pdf_public_id" VARCHAR(512),
    "pdf_secure_url" VARCHAR(2048),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_line_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "quotation_id" TEXT NOT NULL,
    "catalog_item_id" TEXT,
    "label" VARCHAR(200) NOT NULL,
    "unit_price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "line_amount" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "quotation_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_daily_counters" (
    "tenant_id" TEXT NOT NULL,
    "date_key" CHAR(8) NOT NULL,
    "last_seq" INTEGER NOT NULL,

    CONSTRAINT "quotation_daily_counters_pkey" PRIMARY KEY ("tenant_id","date_key")
);

-- CreateIndex
CREATE INDEX "quotation_service_items_tenant_id_is_active_sort_order_idx" ON "quotation_service_items"("tenant_id", "is_active", "sort_order");

-- CreateIndex
CREATE INDEX "quotations_tenant_id_created_at_idx" ON "quotations"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "quotations_tenant_id_status_idx" ON "quotations"("tenant_id", "status");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_tenant_id_quote_number_key" ON "quotations"("tenant_id", "quote_number");

-- CreateIndex
CREATE INDEX "quotation_line_items_quotation_id_sort_order_idx" ON "quotation_line_items"("quotation_id", "sort_order");

-- AddForeignKey
ALTER TABLE "quotation_service_items" ADD CONSTRAINT "quotation_service_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_line_items" ADD CONSTRAINT "quotation_line_items_quotation_id_fkey" FOREIGN KEY ("quotation_id") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_line_items" ADD CONSTRAINT "quotation_line_items_catalog_item_id_fkey" FOREIGN KEY ("catalog_item_id") REFERENCES "quotation_service_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_daily_counters" ADD CONSTRAINT "quotation_daily_counters_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
