-- CreateEnum
CREATE TYPE "CrewGroupAvailabilityMode" AS ENUM ('ROSTER', 'DAY_OFF');

-- CreateEnum
CREATE TYPE "CrewUiLanguage" AS ENUM ('KO', 'TH', 'MN');

-- AlterTable
ALTER TABLE "team_crew_groups" ADD COLUMN "availability_mode" "CrewGroupAvailabilityMode" NOT NULL DEFAULT 'ROSTER';
ALTER TABLE "team_crew_groups" ADD COLUMN "crew_ui_language" "CrewUiLanguage" NOT NULL DEFAULT 'KO';
ALTER TABLE "team_crew_groups" ADD COLUMN "allow_crew_day_off_edit" BOOLEAN NOT NULL DEFAULT false;

-- Backfill from legacy use_daily_roster_only
UPDATE "team_crew_groups"
SET "availability_mode" = CASE
  WHEN "use_daily_roster_only" THEN 'ROSTER'::"CrewGroupAvailabilityMode"
  ELSE 'DAY_OFF'::"CrewGroupAvailabilityMode"
END;

-- AlterTable
ALTER TABLE "team_crew_groups" DROP COLUMN "use_daily_roster_only";
