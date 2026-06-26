-- 팀장조정(관리 스케줄) vs 팀장 본인 휴무 등록 분리
ALTER TABLE "user_day_offs" ADD COLUMN "admin_slot_adjust" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "user_day_offs" ADD COLUMN "self_registered" BOOLEAN NOT NULL DEFAULT false;

-- 기존 행: 팀장 앱 휴무 달력에 보이던 기록은 본인 등록으로 간주
UPDATE "user_day_offs" SET "self_registered" = true WHERE "admin_slot_adjust" = false;
