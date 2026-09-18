-- CreateEnum
CREATE TYPE "PlatformSupportSenderKind" AS ENUM ('PLATFORM', 'TENANT');

-- CreateEnum
CREATE TYPE "PlatformSupportWaitingOn" AS ENUM ('PLATFORM', 'TENANT');

-- CreateTable
CREATE TABLE "platform_support_threads" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "last_message_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_message_preview" VARCHAR(200) NOT NULL DEFAULT '',
    "last_sender_kind" "PlatformSupportSenderKind",
    "waiting_on" "PlatformSupportWaitingOn",
    "platform_read_at" TIMESTAMP(3),
    "last_tenant_email_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_support_threads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_support_messages" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sender_kind" "PlatformSupportSenderKind" NOT NULL,
    "sender_platform_user_id" TEXT,
    "sender_user_id" TEXT,
    "broadcast_batch_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "platform_support_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_support_tenant_reads" (
    "id" TEXT NOT NULL,
    "thread_id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "last_read_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_support_tenant_reads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_support_threads_tenant_id_key" ON "platform_support_threads"("tenant_id");

-- CreateIndex
CREATE INDEX "platform_support_threads_last_message_at_idx" ON "platform_support_threads"("last_message_at");

-- CreateIndex
CREATE INDEX "platform_support_threads_waiting_on_last_message_at_idx" ON "platform_support_threads"("waiting_on", "last_message_at");

-- CreateIndex
CREATE INDEX "platform_support_messages_thread_id_created_at_idx" ON "platform_support_messages"("thread_id", "created_at");

-- CreateIndex
CREATE INDEX "platform_support_messages_tenant_id_created_at_idx" ON "platform_support_messages"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "platform_support_messages_broadcast_batch_id_idx" ON "platform_support_messages"("broadcast_batch_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_support_tenant_reads_thread_id_user_id_key" ON "platform_support_tenant_reads"("thread_id", "user_id");

-- CreateIndex
CREATE INDEX "platform_support_tenant_reads_tenant_id_user_id_idx" ON "platform_support_tenant_reads"("tenant_id", "user_id");

-- AddForeignKey
ALTER TABLE "platform_support_threads" ADD CONSTRAINT "platform_support_threads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_support_messages" ADD CONSTRAINT "platform_support_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "platform_support_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_support_messages" ADD CONSTRAINT "platform_support_messages_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_support_messages" ADD CONSTRAINT "platform_support_messages_sender_platform_user_id_fkey" FOREIGN KEY ("sender_platform_user_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_support_messages" ADD CONSTRAINT "platform_support_messages_sender_user_id_fkey" FOREIGN KEY ("sender_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_support_tenant_reads" ADD CONSTRAINT "platform_support_tenant_reads_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "platform_support_threads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_support_tenant_reads" ADD CONSTRAINT "platform_support_tenant_reads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_support_tenant_reads" ADD CONSTRAINT "platform_support_tenant_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
