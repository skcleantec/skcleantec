-- AlterTable
ALTER TABLE "assignments" ADD COLUMN "crew_meeting_time" VARCHAR(5),
ADD COLUMN "crew_meeting_time_updated_at" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "inquiry_crew_leader_assignments" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "team_leader_id" TEXT NOT NULL,
    "crew_member_name" VARCHAR(64) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiry_crew_leader_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inquiry_crew_leader_assignments_inquiry_id_crew_member_name_key" ON "inquiry_crew_leader_assignments"("inquiry_id", "crew_member_name");

-- CreateIndex
CREATE INDEX "inquiry_crew_leader_assignments_tenant_id_inquiry_id_idx" ON "inquiry_crew_leader_assignments"("tenant_id", "inquiry_id");

-- CreateIndex
CREATE INDEX "inquiry_crew_leader_assignments_inquiry_id_team_leader_id_idx" ON "inquiry_crew_leader_assignments"("inquiry_id", "team_leader_id");

-- AddForeignKey
ALTER TABLE "inquiry_crew_leader_assignments" ADD CONSTRAINT "inquiry_crew_leader_assignments_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_crew_leader_assignments" ADD CONSTRAINT "inquiry_crew_leader_assignments_team_leader_id_fkey" FOREIGN KEY ("team_leader_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
