-- AI 미리 배정 초안. 승인 전에는 assignments 를 만들지 않는다.

CREATE TYPE "AiDispatchRunStatus" AS ENUM ('DRAFT', 'APPROVED', 'SUPERSEDED');
CREATE TYPE "AiDispatchProposalStatus" AS ENUM ('DRAFT', 'APPROVED', 'SKIPPED', 'STALE');

CREATE TABLE "tenant_ai_dispatch_settings" (
    "tenant_id" TEXT NOT NULL,
    "extra_leader_min_pyeong" INTEGER NOT NULL DEFAULT 40,
    "extra_leader_count" INTEGER NOT NULL DEFAULT 2,
    "two_room_max_pyeong" INTEGER NOT NULL DEFAULT 15,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_ai_dispatch_settings_pkey" PRIMARY KEY ("tenant_id")
);

CREATE TABLE "ai_dispatch_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "work_date" DATE NOT NULL,
    "status" "AiDispatchRunStatus" NOT NULL DEFAULT 'DRAFT',
    "created_by_id" TEXT NOT NULL,
    "summary" TEXT,
    "model" VARCHAR(64),
    "prompt_tokens" INTEGER NOT NULL DEFAULT 0,
    "completion_tokens" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_dispatch_runs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ai_dispatch_proposals" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "run_id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "team_leader_id" TEXT,
    "slot" VARCHAR(16) NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "AiDispatchProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "inquiry_updated_at" TIMESTAMP(3) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "ai_dispatch_proposals_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ai_dispatch_runs_tenant_id_work_date_idx" ON "ai_dispatch_runs"("tenant_id", "work_date");
CREATE INDEX "ai_dispatch_proposals_tenant_id_run_id_idx" ON "ai_dispatch_proposals"("tenant_id", "run_id");
CREATE INDEX "ai_dispatch_proposals_tenant_id_inquiry_id_idx" ON "ai_dispatch_proposals"("tenant_id", "inquiry_id");

ALTER TABLE "tenant_ai_dispatch_settings" ADD CONSTRAINT "tenant_ai_dispatch_settings_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_dispatch_runs" ADD CONSTRAINT "ai_dispatch_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_dispatch_proposals" ADD CONSTRAINT "ai_dispatch_proposals_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "ai_dispatch_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_dispatch_proposals" ADD CONSTRAINT "ai_dispatch_proposals_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ai_dispatch_proposals" ADD CONSTRAINT "ai_dispatch_proposals_team_leader_id_fkey" FOREIGN KEY ("team_leader_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
