-- 현장 팀원 입·퇴사일 (User 와 동일 규칙: 입사일 포함, 퇴사일 미포함)
ALTER TABLE "team_members" ADD COLUMN "hire_date" DATE;
ALTER TABLE "team_members" ADD COLUMN "resignation_date" DATE;
