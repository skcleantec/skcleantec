-- CreateTable
CREATE TABLE "telecrm_sms_templates" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "owner_user_id" TEXT,
    "label" VARCHAR(120) NOT NULL,
    "body" TEXT NOT NULL,
    "image_url" VARCHAR(512),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telecrm_sms_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "telecrm_call_notes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "body" TEXT NOT NULL,
    "inquiry_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telecrm_call_notes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "telecrm_sms_templates_tenant_id_owner_user_id_sort_order_idx" ON "telecrm_sms_templates"("tenant_id", "owner_user_id", "sort_order");

-- CreateIndex
CREATE INDEX "telecrm_call_notes_tenant_id_user_id_phone_created_at_idx" ON "telecrm_call_notes"("tenant_id", "user_id", "phone", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "telecrm_sms_templates" ADD CONSTRAINT "telecrm_sms_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_sms_templates" ADD CONSTRAINT "telecrm_sms_templates_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_call_notes" ADD CONSTRAINT "telecrm_call_notes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_call_notes" ADD CONSTRAINT "telecrm_call_notes_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_call_notes" ADD CONSTRAINT "telecrm_call_notes_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
