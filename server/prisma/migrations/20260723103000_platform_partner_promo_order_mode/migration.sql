-- CreateEnum
CREATE TYPE "PlatformPromoOrderMode" AS ENUM ('FIXED', 'RANDOM');

-- CreateEnum
CREATE TYPE "PlatformPromoOrderModeOverride" AS ENUM ('INHERIT', 'FIXED', 'RANDOM');

-- CreateTable
CREATE TABLE "platform_partner_promo_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "external_partner_order_mode" "PlatformPromoOrderMode" NOT NULL DEFAULT 'FIXED',
    "tenant_staff_order_mode" "PlatformPromoOrderMode" NOT NULL DEFAULT 'FIXED',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_partner_promo_settings_pkey" PRIMARY KEY ("id")
);

INSERT INTO "platform_partner_promo_settings" ("id", "external_partner_order_mode", "tenant_staff_order_mode", "updated_at")
VALUES ('default', 'FIXED', 'FIXED', CURRENT_TIMESTAMP);

-- AlterTable
ALTER TABLE "platform_partner_promos" ADD COLUMN "order_mode_override" "PlatformPromoOrderModeOverride" NOT NULL DEFAULT 'INHERIT';
