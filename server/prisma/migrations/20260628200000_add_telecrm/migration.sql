-- CreateTable
CREATE TABLE "telecrm_script_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telecrm_script_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telecrm_script_tabs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "body" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telecrm_script_tabs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telecrm_price_categories" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telecrm_price_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telecrm_price_items" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "amount_won" INTEGER NOT NULL,
    "description" VARCHAR(500),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telecrm_price_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telecrm_script_categories_tenant_id_sort_order_idx" ON "telecrm_script_categories"("tenant_id", "sort_order");

-- CreateIndex
CREATE INDEX "telecrm_script_tabs_tenant_id_category_id_sort_order_idx" ON "telecrm_script_tabs"("tenant_id", "category_id", "sort_order");

-- CreateIndex
CREATE INDEX "telecrm_price_categories_tenant_id_sort_order_idx" ON "telecrm_price_categories"("tenant_id", "sort_order");

-- CreateIndex
CREATE INDEX "telecrm_price_items_tenant_id_category_id_sort_order_idx" ON "telecrm_price_items"("tenant_id", "category_id", "sort_order");

-- AddForeignKey
ALTER TABLE "telecrm_script_categories" ADD CONSTRAINT "telecrm_script_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_script_tabs" ADD CONSTRAINT "telecrm_script_tabs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_script_tabs" ADD CONSTRAINT "telecrm_script_tabs_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "telecrm_script_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_price_categories" ADD CONSTRAINT "telecrm_price_categories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_price_items" ADD CONSTRAINT "telecrm_price_items_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_price_items" ADD CONSTRAINT "telecrm_price_items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "telecrm_price_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
