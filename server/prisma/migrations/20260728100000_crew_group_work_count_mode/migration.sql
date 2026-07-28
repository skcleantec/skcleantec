-- CreateEnum
CREATE TYPE "CrewWorkCountMode" AS ENUM ('DISTINCT_DAY', 'PER_INQUIRY');

-- AlterTable
ALTER TABLE "team_crew_groups" ADD COLUMN "work_count_mode" "CrewWorkCountMode" NOT NULL DEFAULT 'DISTINCT_DAY';
