-- 팀장 단독(크루 없음) 플래그: 접수 → 배정(Assignment) 단위로 이동
ALTER TABLE "assignments" ADD COLUMN "no_crew_members" BOOLEAN NOT NULL DEFAULT false;

UPDATE "assignments" AS a
SET "no_crew_members" = true
FROM "inquiries" AS i
WHERE a."inquiry_id" = i."id" AND i."no_crew_members" = true;

ALTER TABLE "inquiries" DROP COLUMN "no_crew_members";
