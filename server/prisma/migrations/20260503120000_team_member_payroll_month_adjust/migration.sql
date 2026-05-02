-- 현장 팀원 월별 수기 추가 근무일(급여표)
CREATE TABLE "team_member_payroll_month_adjusts" (
    "id" TEXT NOT NULL,
    "team_member_id" TEXT NOT NULL,
    "month_key" VARCHAR(7) NOT NULL,
    "extra_work_days" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_member_payroll_month_adjusts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "team_member_payroll_month_adjusts_team_member_id_month_key_key" ON "team_member_payroll_month_adjusts"("team_member_id", "month_key");

CREATE INDEX "team_member_payroll_month_adjusts_month_key_idx" ON "team_member_payroll_month_adjusts"("month_key");

ALTER TABLE "team_member_payroll_month_adjusts" ADD CONSTRAINT "team_member_payroll_month_adjusts_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
