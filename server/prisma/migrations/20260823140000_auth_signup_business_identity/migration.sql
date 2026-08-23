-- ADMIN SNS 가입 · 사업자 검증 Phase 1 (`docs/auth-signup/DATA_MODEL.md`)

-- CreateEnum
CREATE TYPE "SignupBusinessType" AS ENUM ('registered_business', 'individual');

-- CreateEnum
CREATE TYPE "AuthIdentityProvider" AS ENUM ('google', 'kakao');

-- AlterTable — SNS-only ADMIN 허용
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

-- CreateTable
CREATE TABLE "tenant_signup_businesses" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "business_type" "SignupBusinessType" NOT NULL,
    "biz_number" VARCHAR(64),
    "business_name" VARCHAR(128),
    "representative_name" VARCHAR(128),
    "address_line" TEXT,
    "business_registration_image_url" VARCHAR(2048),
    "business_registration_image_public_id" VARCHAR(512),
    "individual_confirmed_at" TIMESTAMP(3),
    "individual_usage_note" VARCHAR(256),
    "submitted_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_signup_businesses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_auth_identities" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "provider" "AuthIdentityProvider" NOT NULL,
    "provider_sub" VARCHAR(128) NOT NULL,
    "provider_email" VARCHAR(256),
    "linked_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_auth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tenant_signup_businesses_tenant_id_key" ON "tenant_signup_businesses"("tenant_id");

-- CreateIndex
CREATE INDEX "tenant_signup_businesses_biz_number_idx" ON "tenant_signup_businesses"("biz_number");

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_identities_provider_provider_sub_key" ON "user_auth_identities"("provider", "provider_sub");

-- CreateIndex
CREATE UNIQUE INDEX "user_auth_identities_tenant_id_user_id_provider_key" ON "user_auth_identities"("tenant_id", "user_id", "provider");

-- CreateIndex
CREATE INDEX "user_auth_identities_tenant_id_user_id_idx" ON "user_auth_identities"("tenant_id", "user_id");

-- AddForeignKey
ALTER TABLE "tenant_signup_businesses" ADD CONSTRAINT "tenant_signup_businesses_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_auth_identities" ADD CONSTRAINT "user_auth_identities_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_auth_identities" ADD CONSTRAINT "user_auth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
