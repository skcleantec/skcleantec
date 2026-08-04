-- Help CMS: markdown 원문 + 렌더 형식 (html | markdown)
ALTER TABLE "help_cms_articles" ADD COLUMN "body_markdown" TEXT;
ALTER TABLE "help_cms_articles" ADD COLUMN "content_format" VARCHAR(16) NOT NULL DEFAULT 'html';
