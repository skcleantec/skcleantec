-- SK클린텍 전용: 네이버로 들어온 옛 홈페이지 문의 메일
CREATE TABLE "sk_homepage_mail_inboxes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "mailbox" VARCHAR(320) NOT NULL DEFAULT '',
    "password_enc" TEXT,
    "last_uid" INTEGER NOT NULL DEFAULT 0,
    "last_sync_at" TIMESTAMP(3),
    "last_error" VARCHAR(300),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "sk_homepage_mail_inboxes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sk_homepage_mail_inboxes_tenant_id_key" ON "sk_homepage_mail_inboxes"("tenant_id");

ALTER TABLE "sk_homepage_mail_inboxes" ADD CONSTRAINT "sk_homepage_mail_inboxes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "sk_homepage_inquiry_mails" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "inbox_id" TEXT NOT NULL,
    "message_id" VARCHAR(255) NOT NULL,
    "imap_uid" INTEGER NOT NULL,
    "from_address" VARCHAR(320) NOT NULL DEFAULT '',
    "subject" VARCHAR(500) NOT NULL DEFAULT '',
    "received_at" TIMESTAMP(3) NOT NULL,
    "text_body" TEXT NOT NULL DEFAULT '',
    "status" VARCHAR(24) NOT NULL DEFAULT 'PENDING_MATCH',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sk_homepage_inquiry_mails_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "sk_homepage_inquiry_mails_tenant_id_message_id_key" ON "sk_homepage_inquiry_mails"("tenant_id", "message_id");

CREATE INDEX "sk_homepage_inquiry_mails_tenant_id_received_at_idx" ON "sk_homepage_inquiry_mails"("tenant_id", "received_at" DESC);

ALTER TABLE "sk_homepage_inquiry_mails" ADD CONSTRAINT "sk_homepage_inquiry_mails_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sk_homepage_inquiry_mails" ADD CONSTRAINT "sk_homepage_inquiry_mails_inbox_id_fkey" FOREIGN KEY ("inbox_id") REFERENCES "sk_homepage_mail_inboxes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
