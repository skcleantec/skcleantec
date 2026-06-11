-- 다중 리뷰 캡처 이미지
ALTER TABLE "review_payback_requests" ADD COLUMN "review_images" JSONB NOT NULL DEFAULT '[]';

UPDATE "review_payback_requests"
SET "review_images" = jsonb_build_array(
  jsonb_strip_nulls(
    jsonb_build_object(
      'url', "review_image_url",
      'publicId', "review_image_public_id"
    )
  )
)
WHERE "review_image_url" IS NOT NULL AND TRIM("review_image_url") <> '';
