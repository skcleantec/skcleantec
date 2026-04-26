-- 크루 공유 그룹(팀원 공유 로그인)·멤버·날짜별 가용 명단
CREATE TABLE "team_crew_groups" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "login_id" VARCHAR(64) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "phone" VARCHAR(32),
    "use_daily_roster_only" BOOLEAN NOT NULL DEFAULT false,
    "settings_password_hash" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_crew_groups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_crew_groups_login_id_key" ON "team_crew_groups"("login_id");

CREATE TABLE "team_crew_group_members" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "team_member_id" TEXT NOT NULL,
    "is_group_leader" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_crew_group_members_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_crew_group_members_group_id_team_member_id_key" ON "team_crew_group_members"("group_id", "team_member_id");
CREATE INDEX "team_crew_group_members_team_member_id_idx" ON "team_crew_group_members"("team_member_id");

CREATE TABLE "team_crew_group_day_roster" (
    "id" TEXT NOT NULL,
    "group_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "team_member_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_crew_group_day_roster_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_crew_group_day_roster_group_id_date_team_member_id_key" ON "team_crew_group_day_roster"("group_id", "date", "team_member_id");
CREATE INDEX "team_crew_group_day_roster_group_id_date_idx" ON "team_crew_group_day_roster"("group_id", "date");

ALTER TABLE "team_crew_group_members" ADD CONSTRAINT "team_crew_group_members_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "team_crew_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_crew_group_members" ADD CONSTRAINT "team_crew_group_members_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_crew_group_day_roster" ADD CONSTRAINT "team_crew_group_day_roster_group_id_fkey" FOREIGN KEY ("group_id") REFERENCES "team_crew_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "team_crew_group_day_roster" ADD CONSTRAINT "team_crew_group_day_roster_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
