-- 1:1 문의: 휴대폰·개인정보 동의·메일 답장 번호, 답변·추가 질문 표
DO $$ BEGIN
  CREATE TYPE "PlatformBoardReplyAuthorType" AS ENUM ('ADMIN', 'CUSTOMER');
EXCEPTION WHEN duplicate_object THEN null; END $$;

DO $$ BEGIN
  CREATE TYPE "PlatformBoardReplySource" AS ENUM ('PLATFORM', 'EMAIL');
EXCEPTION WHEN duplicate_object THEN null; END $$;

ALTER TABLE "platform_board_posts" ADD COLUMN IF NOT EXISTS "author_phone" VARCHAR(20);
ALTER TABLE "platform_board_posts" ADD COLUMN IF NOT EXISTS "privacy_consent_at" TIMESTAMP(3);
ALTER TABLE "platform_board_posts" ADD COLUMN IF NOT EXISTS "privacy_consent_version" VARCHAR(32);
ALTER TABLE "platform_board_posts" ADD COLUMN IF NOT EXISTS "reply_token" VARCHAR(12);
CREATE UNIQUE INDEX IF NOT EXISTS "platform_board_posts_reply_token_key" ON "platform_board_posts"("reply_token");

CREATE TABLE IF NOT EXISTS "platform_board_replies" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "author_type" "PlatformBoardReplyAuthorType" NOT NULL,
    "source" "PlatformBoardReplySource" NOT NULL,
    "body_html" TEXT NOT NULL,
    "body_text" TEXT NOT NULL,
    "from_email" VARCHAR(320),
    "platform_user_id" TEXT,
    "message_id" VARCHAR(512),
    "email_sent_at" TIMESTAMP(3),
    "email_error" VARCHAR(500),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_board_replies_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "platform_board_replies_message_id_key" ON "platform_board_replies"("message_id");
CREATE INDEX IF NOT EXISTS "platform_board_replies_post_id_created_at_idx" ON "platform_board_replies"("post_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "platform_board_replies" ADD CONSTRAINT "platform_board_replies_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "platform_board_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
