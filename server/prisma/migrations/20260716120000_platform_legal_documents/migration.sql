-- CreateEnum
CREATE TYPE "PlatformLegalDocumentType" AS ENUM ('MEMBER_TERMS', 'CONSUMER_ORDER_CONSENT');

-- CreateTable
CREATE TABLE "platform_legal_documents" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "document_type" "PlatformLegalDocumentType" NOT NULL,
    "content_html" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_legal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_legal_invites" (
    "id" TEXT NOT NULL,
    "token" VARCHAR(64) NOT NULL,
    "document_id" TEXT NOT NULL,
    "memo" VARCHAR(256),
    "expires_at" TIMESTAMP(3),
    "used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_id" TEXT,

    CONSTRAINT "platform_legal_invites_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_legal_agreements" (
    "id" TEXT NOT NULL,
    "document_id" TEXT NOT NULL,
    "document_version" INTEGER NOT NULL,
    "content_snapshot" TEXT NOT NULL,
    "invite_id" TEXT,
    "company_name" VARCHAR(256) NOT NULL,
    "signer_name" VARCHAR(128) NOT NULL,
    "signer_title" VARCHAR(128) NOT NULL,
    "signer_email" VARCHAR(256),
    "signer_phone" VARCHAR(64),
    "tenant_slug" VARCHAR(32),
    "agreed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "signer_ip" VARCHAR(64),
    "signer_user_agent" TEXT,

    CONSTRAINT "platform_legal_agreements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_legal_documents_slug_key" ON "platform_legal_documents"("slug");

-- CreateIndex
CREATE INDEX "platform_legal_documents_document_type_idx" ON "platform_legal_documents"("document_type");

-- CreateIndex
CREATE UNIQUE INDEX "platform_legal_invites_token_key" ON "platform_legal_invites"("token");

-- CreateIndex
CREATE INDEX "platform_legal_invites_document_id_created_at_idx" ON "platform_legal_invites"("document_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "platform_legal_agreements_document_id_agreed_at_idx" ON "platform_legal_agreements"("document_id", "agreed_at" DESC);

-- AddForeignKey
ALTER TABLE "platform_legal_invites" ADD CONSTRAINT "platform_legal_invites_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "platform_legal_documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_legal_agreements" ADD CONSTRAINT "platform_legal_agreements_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "platform_legal_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_legal_agreements" ADD CONSTRAINT "platform_legal_agreements_invite_id_fkey" FOREIGN KEY ("invite_id") REFERENCES "platform_legal_invites"("id") ON DELETE SET NULL ON UPDATE CASCADE;
