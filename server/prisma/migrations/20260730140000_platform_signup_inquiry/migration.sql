-- CreateEnum
CREATE TYPE "PlatformSignupInquiryStatus" AS ENUM ('PENDING', 'CONTACTED', 'APPROVED', 'REJECTED', 'CONVERTED', 'CLOSED');

-- CreateTable
CREATE TABLE "platform_signup_inquiries" (
    "id" TEXT NOT NULL,
    "status" "PlatformSignupInquiryStatus" NOT NULL DEFAULT 'PENDING',
    "company_name" VARCHAR(128) NOT NULL,
    "contact_name" VARCHAR(64) NOT NULL,
    "contact_phone" VARCHAR(32) NOT NULL,
    "contact_email" VARCHAR(256),
    "team_leader_range" VARCHAR(32),
    "desired_plan" VARCHAR(32) NOT NULL DEFAULT 'unknown',
    "message" VARCHAR(4000) NOT NULL,
    "source" VARCHAR(32) NOT NULL DEFAULT 'landing',
    "source_page_url" VARCHAR(512),
    "request_ip" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "admin_note" VARCHAR(2000),
    "reviewed_by_platform_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "converted_tenant_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_signup_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_signup_inquiry_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "notify_emails" JSONB NOT NULL DEFAULT '[]',
    "reply_to_email" VARCHAR(256),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_signup_inquiry_settings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "platform_signup_inquiries_status_created_at_idx" ON "platform_signup_inquiries"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "platform_signup_inquiries_created_at_idx" ON "platform_signup_inquiries"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "platform_signup_inquiries" ADD CONSTRAINT "platform_signup_inquiries_reviewed_by_platform_user_id_fkey" FOREIGN KEY ("reviewed_by_platform_user_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_signup_inquiries" ADD CONSTRAINT "platform_signup_inquiries_converted_tenant_id_fkey" FOREIGN KEY ("converted_tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default settings row
INSERT INTO "platform_signup_inquiry_settings" ("id", "notify_emails", "updated_at")
VALUES ('default', '[]', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
