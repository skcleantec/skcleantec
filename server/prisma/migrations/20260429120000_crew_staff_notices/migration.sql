-- 운영(관리자·마케터) 공지 중 「크루」 수신 대상 — 공유 계정(팀 크루 그룹) 조회용
CREATE TABLE "crew_staff_notices" (
    "id" TEXT NOT NULL,
    "batch_id" VARCHAR(64) NOT NULL,
    "sender_id" TEXT NOT NULL,
    "crew_group_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "crew_staff_notices_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crew_staff_notices_crew_group_id_created_at_idx" ON "crew_staff_notices"("crew_group_id", "created_at" DESC);

ALTER TABLE "crew_staff_notices" ADD CONSTRAINT "crew_staff_notices_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "crew_staff_notices" ADD CONSTRAINT "crew_staff_notices_crew_group_id_fkey" FOREIGN KEY ("crew_group_id") REFERENCES "team_crew_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
