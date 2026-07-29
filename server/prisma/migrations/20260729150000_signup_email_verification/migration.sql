-- CreateEnum
CREATE TYPE "EmailVerificationPurpose" AS ENUM ('TENANT_SIGNUP', 'PASSWORD_RESET');

-- AlterTable
ALTER TABLE "users" ADD COLUMN "recovery_email" VARCHAR(256);

-- CreateTable
CREATE TABLE "email_verification_challenges" (
    "id" TEXT NOT NULL,
    "purpose" "EmailVerificationPurpose" NOT NULL,
    "email" VARCHAR(256) NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "payload" JSONB NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "consumed_at" TIMESTAMP(3),
    "request_ip" VARCHAR(64),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_verification_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_verification_challenges_email_purpose_created_at_idx" ON "email_verification_challenges"("email", "purpose", "created_at" DESC);

-- CreateIndex
CREATE INDEX "email_verification_challenges_purpose_expires_at_idx" ON "email_verification_challenges"("purpose", "expires_at");
