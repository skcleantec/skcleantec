-- CreateTable
CREATE TABLE "telecrm_soomgo_message_presets" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "slot_number" INTEGER NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "steps_json" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telecrm_soomgo_message_presets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telecrm_soomgo_message_presets_tenant_id_owner_user_id_slot_n_idx" ON "telecrm_soomgo_message_presets"("tenant_id", "owner_user_id", "slot_number");

-- CreateIndex
CREATE INDEX "telecrm_soomgo_message_presets_tenant_id_owner_user_id_sort__idx" ON "telecrm_soomgo_message_presets"("tenant_id", "owner_user_id", "sort_order");

-- AddForeignKey
ALTER TABLE "telecrm_soomgo_message_presets" ADD CONSTRAINT "telecrm_soomgo_message_presets_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_soomgo_message_presets" ADD CONSTRAINT "telecrm_soomgo_message_presets_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
