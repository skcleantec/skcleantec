-- AlterTable
ALTER TABLE "help_cms_articles" ADD COLUMN IF NOT EXISTS "keywords" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- CreateTable
CREATE TABLE IF NOT EXISTS "help_cms_article_feedbacks" (
    "id" TEXT NOT NULL,
    "article_id" TEXT NOT NULL,
    "helpful" BOOLEAN NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "client_hash" VARCHAR(128),

    CONSTRAINT "help_cms_article_feedbacks_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "platform_board_posts" ADD COLUMN IF NOT EXISTS "thumbnail_url" VARCHAR(512);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "help_cms_article_feedbacks_article_id_helpful_idx" ON "help_cms_article_feedbacks"("article_id", "helpful");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "help_cms_article_feedbacks_article_id_client_hash_created_at_idx" ON "help_cms_article_feedbacks"("article_id", "client_hash", "created_at");

-- AddForeignKey
ALTER TABLE "help_cms_article_feedbacks" DROP CONSTRAINT IF EXISTS "help_cms_article_feedbacks_article_id_fkey";
ALTER TABLE "help_cms_article_feedbacks" ADD CONSTRAINT "help_cms_article_feedbacks_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "help_cms_articles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
