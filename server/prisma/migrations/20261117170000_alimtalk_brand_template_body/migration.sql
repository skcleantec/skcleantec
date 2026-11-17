-- 업체 채널 서식은 청소 안내 3종. 승인본 본문을 저장한다.

ALTER TABLE "alimtalk_brand_templates"
  ADD COLUMN "content" TEXT,
  ADD COLUMN "title" VARCHAR(200),
  ADD COLUMN "extra" TEXT,
  ADD COLUMN "buttons_json" JSONB,
  ADD COLUMN "message_type" INTEGER,
  ADD COLUMN "emphasize_type" INTEGER;

DELETE FROM "alimtalk_brand_templates"
WHERE "template_code" = 'CBISEO_CUST_PAY_LINK';
