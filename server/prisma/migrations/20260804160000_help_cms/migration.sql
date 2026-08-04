-- CreateTable
CREATE TABLE "help_cms_categories" (
    "id" TEXT NOT NULL,
    "slug" VARCHAR(64) NOT NULL,
    "label" VARCHAR(128) NOT NULL,
    "description" TEXT,
    "tab_group" VARCHAR(32) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_cms_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_cms_articles" (
    "id" TEXT NOT NULL,
    "category_id" TEXT NOT NULL,
    "slug" VARCHAR(128) NOT NULL,
    "title" VARCHAR(256) NOT NULL,
    "excerpt" VARCHAR(500),
    "cover_image_url" VARCHAR(512),
    "body_html" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_published" BOOLEAN NOT NULL DEFAULT false,
    "published_at" TIMESTAMP(3),
    "author_platform_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_cms_articles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "help_cms_categories_slug_key" ON "help_cms_categories"("slug");

-- CreateIndex
CREATE INDEX "help_cms_categories_tab_group_is_published_sort_order_idx" ON "help_cms_categories"("tab_group", "is_published", "sort_order");

-- CreateIndex
CREATE UNIQUE INDEX "help_cms_articles_slug_key" ON "help_cms_articles"("slug");

-- CreateIndex
CREATE INDEX "help_cms_articles_category_id_is_published_sort_order_idx" ON "help_cms_articles"("category_id", "is_published", "sort_order");

-- AddForeignKey
ALTER TABLE "help_cms_articles" ADD CONSTRAINT "help_cms_articles_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "help_cms_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "help_cms_articles" ADD CONSTRAINT "help_cms_articles_author_platform_user_id_fkey" FOREIGN KEY ("author_platform_user_id") REFERENCES "platform_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
