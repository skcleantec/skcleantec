-- 현장 팀원 월별 급여 정산 완료 기록 (귀속 월당 1건)
CREATE TABLE "team_member_payroll_settlements" (
    "id" TEXT NOT NULL,
    "team_member_id" TEXT NOT NULL,
    "month_key" VARCHAR(7) NOT NULL,
    "amount" INTEGER NOT NULL,
    "settled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,

    CONSTRAINT "team_member_payroll_settlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_member_payroll_settlements_team_member_id_month_key_key" ON "team_member_payroll_settlements"("team_member_id", "month_key");

CREATE INDEX "team_member_payroll_settlements_team_member_id_settled_at_idx" ON "team_member_payroll_settlements"("team_member_id", "settled_at");

ALTER TABLE "team_member_payroll_settlements" ADD CONSTRAINT "team_member_payroll_settlements_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_member_payroll_settlements" ADD CONSTRAINT "team_member_payroll_settlements_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
