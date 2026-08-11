-- AlterEnum
ALTER TYPE "OrderFormSubmissionEmailStatus" ADD VALUE 'SKIPPED_NO_PLATFORM_SMTP';

-- CreateTable
CREATE TABLE "platform_smtp_profiles" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "purposes" JSONB NOT NULL DEFAULT '[]',
    "smtp_host" VARCHAR(256),
    "smtp_port" INTEGER,
    "smtp_secure" BOOLEAN,
    "smtp_user" VARCHAR(256),
    "smtp_from" VARCHAR(256),
    "smtp_pass_enc" TEXT,
    "default_display_name" VARCHAR(128),
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_smtp_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_smtp_profiles_slug_key" ON "platform_smtp_profiles"("slug");

-- CreateIndex
CREATE INDEX "platform_smtp_profiles_enabled_sort_order_idx" ON "platform_smtp_profiles"("enabled", "sort_order");

-- Seed: customer noreply profile (password via platform UI)
INSERT INTO "platform_smtp_profiles" (
    "id",
    "slug",
    "label",
    "enabled",
    "purposes",
    "smtp_host",
    "smtp_port",
    "smtp_secure",
    "smtp_from",
    "default_display_name",
    "sort_order",
    "updated_at"
) VALUES (
    gen_random_uuid()::text,
    'customer-noreply',
    '고객 자동발송 (noreply)',
    true,
    '["ORDER_FORM_SUBMISSION","INSPECTION_COMPLETION"]'::jsonb,
    'smtp.gmail.com',
    587,
    false,
    'noreply@service-bridges.com',
    '청소비서',
    0,
    CURRENT_TIMESTAMP
);
