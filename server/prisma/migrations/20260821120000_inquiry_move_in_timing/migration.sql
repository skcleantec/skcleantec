-- CreateEnum
CREATE TYPE "MoveInTiming" AS ENUM ('SAME_DAY', 'PLANNED', 'NOT_APPLICABLE');

-- AlterTable
ALTER TABLE "inquiries" ADD COLUMN "move_in_timing" "MoveInTiming";

-- Backfill: 미정 → 이사예정
UPDATE "inquiries"
SET "move_in_timing" = 'PLANNED'
WHERE "move_in_date_undecided" = true AND "move_in_timing" IS NULL;

-- Backfill: 이사일 있음 → 이사예정 (당일 매칭은 다음 단계)
UPDATE "inquiries"
SET "move_in_timing" = 'PLANNED'
WHERE "move_in_date" IS NOT NULL AND "move_in_timing" IS NULL;

-- Backfill: 청소일과 이사일이 같으면 당일이사
UPDATE "inquiries"
SET "move_in_timing" = 'SAME_DAY'
WHERE "move_in_timing" = 'PLANNED'
  AND "move_in_date" IS NOT NULL
  AND "preferred_date" IS NOT NULL
  AND ("move_in_date" AT TIME ZONE 'Asia/Seoul')::date = ("preferred_date" AT TIME ZONE 'Asia/Seoul')::date;

-- Backfill: 거주·이사 정보 없음 → 해당없음
UPDATE "inquiries"
SET "move_in_timing" = 'NOT_APPLICABLE'
WHERE "move_in_timing" IS NULL
  AND "move_in_date" IS NULL
  AND "move_in_date_undecided" = false
  AND (
    "building_type" IS NULL
    OR "building_type" = '거주(짐이있는상태)'
  );
