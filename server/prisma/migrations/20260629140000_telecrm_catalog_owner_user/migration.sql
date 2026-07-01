-- AlterTable
ALTER TABLE "telecrm_script_categories" ADD COLUMN "owner_user_id" TEXT;

-- AlterTable
ALTER TABLE "telecrm_price_categories" ADD COLUMN "owner_user_id" TEXT;

-- CreateIndex
CREATE INDEX "telecrm_script_categories_tenant_id_owner_user_id_sort_order_idx" ON "telecrm_script_categories"("tenant_id", "owner_user_id", "sort_order");

-- CreateIndex
CREATE INDEX "telecrm_price_categories_tenant_id_owner_user_id_sort_order_idx" ON "telecrm_price_categories"("tenant_id", "owner_user_id", "sort_order");

-- AddForeignKey
ALTER TABLE "telecrm_script_categories" ADD CONSTRAINT "telecrm_script_categories_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_price_categories" ADD CONSTRAINT "telecrm_price_categories_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
