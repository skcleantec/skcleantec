-- CreateTable
CREATE TABLE "platform_partner_promos" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(128) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "mobile_image_url" VARCHAR(512) NOT NULL,
    "desktop_image_url" VARCHAR(512) NOT NULL,
    "link_url" VARCHAR(512),
    "link_target" VARCHAR(16) NOT NULL DEFAULT '_blank',
    "starts_at" TIMESTAMP(3),
    "ends_at" TIMESTAMP(3),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "show_on_mobile" BOOLEAN NOT NULL DEFAULT true,
    "show_on_desktop" BOOLEAN NOT NULL DEFAULT true,
    "show_to_external_partner" BOOLEAN NOT NULL DEFAULT true,
    "show_to_tenant_staff" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_platform_user_id" VARCHAR(64),

    CONSTRAINT "platform_partner_promos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_partner_promos_is_active_sort_order_idx" ON "platform_partner_promos"("is_active", "sort_order");
