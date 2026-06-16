-- 팀원별 크루 미팅 시각 + 공용/개별 모드 플래그
ALTER TABLE "inquiries" ADD COLUMN "crew_meeting_time_shared" BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE "inquiry_crew_member_meeting_times" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "team_member_id" TEXT NOT NULL,
    "meeting_time" VARCHAR(5) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiry_crew_member_meeting_times_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inquiry_crew_member_meeting_times_inquiry_id_team_member_id_key" ON "inquiry_crew_member_meeting_times"("inquiry_id", "team_member_id");

CREATE INDEX "inquiry_crew_member_meeting_times_tenant_id_inquiry_id_idx" ON "inquiry_crew_member_meeting_times"("tenant_id", "inquiry_id");

ALTER TABLE "inquiry_crew_member_meeting_times" ADD CONSTRAINT "inquiry_crew_member_meeting_times_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inquiry_crew_member_meeting_times" ADD CONSTRAINT "inquiry_crew_member_meeting_times_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
