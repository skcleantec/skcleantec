-- 관리자가 AI 초안을 고친 기록과, 지난 배정 거리 요약. 고객 이름·전화는 저장하지 않는다.

ALTER TABLE "ai_dispatch_proposals" ADD COLUMN "ai_team_leader_id" TEXT;

UPDATE "ai_dispatch_proposals"
SET "ai_team_leader_id" = "team_leader_id"
WHERE "ai_team_leader_id" IS NULL
  AND "reason" NOT LIKE '%관리자가 수정%'
  AND "reason" NOT LIKE '%관리자가 팀장을 뺐%';

CREATE TABLE "ai_dispatch_lessons" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "kind" VARCHAR(16) NOT NULL,
    "fingerprint" VARCHAR(80) NOT NULL,
    "text" VARCHAR(300) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_dispatch_lessons_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ai_dispatch_lessons_tenant_id_fingerprint_key" ON "ai_dispatch_lessons"("tenant_id", "fingerprint");
CREATE INDEX "ai_dispatch_lessons_tenant_id_kind_updated_at_idx" ON "ai_dispatch_lessons"("tenant_id", "kind", "updated_at");

ALTER TABLE "ai_dispatch_lessons" ADD CONSTRAINT "ai_dispatch_lessons_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
