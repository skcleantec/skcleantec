-- CreateTable
CREATE TABLE "help_inquiry_settings" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "contact_email" VARCHAR(256) NOT NULL DEFAULT 'pyo0829@gmail.com',
    "notify_email" VARCHAR(256) NOT NULL DEFAULT 'pyo0829@gmail.com',
    "compose_help_text" TEXT,
    "categories_json" JSONB NOT NULL DEFAULT '[{"id":"general","label":"일반 문의","sortOrder":0},{"id":"feature","label":"기능 요청","sortOrder":1},{"id":"bug","label":"버그 신고","sortOrder":2}]',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "help_inquiry_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "help_inquiry_posts" (
    "id" TEXT NOT NULL,
    "category_id" VARCHAR(64) NOT NULL,
    "author_name" VARCHAR(64) NOT NULL,
    "author_email" VARCHAR(256) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body_markdown" TEXT NOT NULL,
    "image_urls" JSONB NOT NULL DEFAULT '[]',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "help_inquiry_posts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "help_inquiry_posts_created_at_idx" ON "help_inquiry_posts"("created_at" DESC);

-- Seed default settings row
INSERT INTO "help_inquiry_settings" ("id", "contact_email", "notify_email", "updated_at")
VALUES ('default', 'pyo0829@gmail.com', 'pyo0829@gmail.com', CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
