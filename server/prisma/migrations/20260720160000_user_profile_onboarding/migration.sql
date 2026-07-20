-- AlterTable
ALTER TABLE "external_companies" ADD COLUMN "business_registration_image_url" VARCHAR(2048),
ADD COLUMN "business_registration_image_public_id" VARCHAR(512);

-- AlterTable
ALTER TABLE "users" ADD COLUMN "profile_completed_at" TIMESTAMP(3);

-- 기존 ADMIN·사무직 — 온보딩 대상 아님
UPDATE "users"
SET "profile_completed_at" = NOW()
WHERE "profile_completed_at" IS NULL
  AND "role" IN ('ADMIN', 'OFFICE_STAFF');

-- 기존 팀장 — 필수 4항목 충족 시 완료 처리
UPDATE "users"
SET "profile_completed_at" = NOW()
WHERE "profile_completed_at" IS NULL
  AND "role" = 'TEAM_LEADER'
  AND TRIM(COALESCE("name", '')) <> ''
  AND TRIM(COALESCE("phone", '')) <> ''
  AND TRIM(COALESCE("vehicle_number", '')) <> ''
  AND TRIM(COALESCE("name_en", '')) <> '';

-- 기존 마케터
UPDATE "users"
SET "profile_completed_at" = NOW()
WHERE "profile_completed_at" IS NULL
  AND "role" = 'MARKETER'
  AND TRIM(COALESCE("name", '')) <> ''
  AND TRIM(COALESCE("phone", '')) <> '';

-- 기존 타업체 담당 — 업체·담당자·사업자등록증 이미지 충족 시
UPDATE "users" AS u
SET "profile_completed_at" = NOW()
FROM "external_companies" AS ec
WHERE u."external_company_id" = ec."id"
  AND u."profile_completed_at" IS NULL
  AND u."role" = 'EXTERNAL_PARTNER'
  AND TRIM(COALESCE(u."name", '')) <> ''
  AND TRIM(COALESCE(u."phone", '')) <> ''
  AND TRIM(COALESCE(ec."name", '')) <> ''
  AND TRIM(COALESCE(ec."biz_number", '')) <> ''
  AND TRIM(COALESCE(ec."phone", '')) <> ''
  AND ec."business_registration_image_url" IS NOT NULL
  AND TRIM(ec."business_registration_image_url") <> '';
