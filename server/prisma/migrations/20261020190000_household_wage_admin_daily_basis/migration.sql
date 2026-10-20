-- 관리자가 팀장별 가계부 임금을 정하고, 일당은 건마다/하루 통합을 고른다.
-- 팀장이 그 설정을 바꿀 수 있는지는 업체 스위치. 기본은 허용(기존과 같음).

CREATE TYPE "TeamLeaderHouseholdDailyPayBasis" AS ENUM ('PER_DAY', 'PER_INQUIRY');

ALTER TABLE "team_leader_household_wage_settings"
  ADD COLUMN "daily_pay_basis" "TeamLeaderHouseholdDailyPayBasis" NOT NULL DEFAULT 'PER_DAY';

ALTER TABLE "tenants"
  ADD COLUMN "team_leader_household_wage_leader_editable" BOOLEAN NOT NULL DEFAULT true;
