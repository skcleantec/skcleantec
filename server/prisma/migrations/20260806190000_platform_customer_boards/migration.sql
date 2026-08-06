-- CreateEnum
CREATE TYPE "PlatformBoardType" AS ENUM ('NOTICE', 'INQUIRY');

-- CreateEnum
CREATE TYPE "PlatformBoardPostStatus" AS ENUM ('OPEN', 'ANSWERED', 'HIDDEN');

-- CreateTable
CREATE TABLE "platform_boards" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "label" VARCHAR(128) NOT NULL,
    "board_type" "PlatformBoardType" NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "list_public" BOOLEAN NOT NULL DEFAULT true,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_boards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_board_categories" (
    "id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "label" VARCHAR(128) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_board_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_board_posts" (
    "id" TEXT NOT NULL,
    "board_id" TEXT NOT NULL,
    "category_id" TEXT,
    "slug" VARCHAR(128),
    "title" VARCHAR(256) NOT NULL,
    "excerpt" VARCHAR(500),
    "body_html" TEXT NOT NULL,
    "author_name" VARCHAR(64),
    "author_email" VARCHAR(256),
    "author_user_id" TEXT,
    "tenant_id" TEXT,
    "is_secret" BOOLEAN NOT NULL DEFAULT false,
    "status" "PlatformBoardPostStatus" NOT NULL DEFAULT 'OPEN',
    "is_pinned" BOOLEAN NOT NULL DEFAULT false,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "published_at" TIMESTAMP(3),
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "author_platform_user_id" TEXT,
    "legacy_help_inquiry_id" VARCHAR(64),
    "legacy_help_cms_slug" VARCHAR(128),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_board_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_boards_slug_key" ON "platform_boards"("slug");

-- CreateIndex
CREATE INDEX "platform_boards_is_published_sort_order_idx" ON "platform_boards"("is_published", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "platform_board_categories_board_id_slug_key" ON "platform_board_categories"("board_id", "slug");

-- CreateIndex
CREATE INDEX "platform_board_categories_board_id_sort_order_idx" ON "platform_board_categories"("board_id", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "platform_board_posts_legacy_help_inquiry_id_key" ON "platform_board_posts"("legacy_help_inquiry_id");

-- CreateIndex
CREATE UNIQUE INDEX "platform_board_posts_legacy_help_cms_slug_key" ON "platform_board_posts"("legacy_help_cms_slug");

-- CreateIndex
CREATE INDEX "platform_board_posts_board_id_is_published_is_pinned_created_idx" ON "platform_board_posts"("board_id", "is_published", "is_pinned", "created_at" DESC);

-- CreateIndex
CREATE INDEX "platform_board_posts_board_id_category_id_created_at_idx" ON "platform_board_posts"("board_id", "category_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "platform_board_posts_board_id_status_created_at_idx" ON "platform_board_posts"("board_id", "status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "platform_board_categories" ADD CONSTRAINT "platform_board_categories_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "platform_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_board_posts" ADD CONSTRAINT "platform_board_posts_board_id_fkey" FOREIGN KEY ("board_id") REFERENCES "platform_boards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_board_posts" ADD CONSTRAINT "platform_board_posts_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "platform_board_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_board_posts" ADD CONSTRAINT "platform_board_posts_author_user_id_fkey" FOREIGN KEY ("author_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_board_posts" ADD CONSTRAINT "platform_board_posts_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "platform_board_posts" ADD CONSTRAINT "platform_board_posts_author_platform_user_id_fkey" FOREIGN KEY ("author_platform_user_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default boards
INSERT INTO "platform_boards" ("id", "slug", "label", "board_type", "sort_order", "is_published", "list_public", "settings", "created_at", "updated_at")
VALUES
  (gen_random_uuid()::text, 'notice', '공지사항', 'NOTICE', 0, true, true, '{}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'inquiry', '문의하기', 'INQUIRY', 1, true, true, '{"maskAuthorNames":true,"notifyEmail":"pyo0829@gmail.com","contactEmail":"pyo0829@gmail.com"}'::jsonb, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
