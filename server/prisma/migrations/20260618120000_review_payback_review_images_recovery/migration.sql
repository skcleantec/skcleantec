-- phase1(20260615120000)만 적용된 DB에 review_images 컬럼이 없을 수 있음.
-- 20260611160000 은 타임스탬프상 더 이르지만, 신규 DB에서는 테이블 생성 전에 실패할 수 있다.
ALTER TABLE "review_payback_requests"
ADD COLUMN IF NOT EXISTS "review_images" JSONB NOT NULL DEFAULT '[]';

UPDATE "review_payback_requests"
SET "review_images" = jsonb_build_array(
  jsonb_strip_nulls(
    jsonb_build_object(
      'url', "review_image_url",
      'publicId', "review_image_public_id"
    )
  )
)
WHERE ("review_images" IS NULL OR "review_images" = '[]'::jsonb)
  AND "review_image_url" IS NOT NULL
  AND TRIM("review_image_url") <> '';
