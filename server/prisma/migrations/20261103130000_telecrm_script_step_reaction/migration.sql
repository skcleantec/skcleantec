-- 상담 스크립트: 대본 단계(step) / 고객 반응(reaction), 비슷한 말, 사용 횟수.
ALTER TABLE "telecrm_script_categories" ADD COLUMN IF NOT EXISTS "kind" TEXT NOT NULL DEFAULT 'step';

ALTER TABLE "telecrm_script_tabs" ADD COLUMN IF NOT EXISTS "keywords" TEXT;
ALTER TABLE "telecrm_script_tabs" ADD COLUMN IF NOT EXISTS "use_count" INTEGER NOT NULL DEFAULT 0;

-- 업체 공통 카테고리 중 이름이 「반론」인 것은 고객 반응 칸으로.
UPDATE "telecrm_script_categories"
SET "kind" = 'reaction'
WHERE "owner_user_id" IS NULL AND "label" = '반론';
