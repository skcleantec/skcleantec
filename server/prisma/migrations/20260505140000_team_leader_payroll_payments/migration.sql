CREATE TABLE "team_leader_payroll_payments" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "month_key" VARCHAR(7) NOT NULL,
    "amount" INTEGER NOT NULL,
    "paid_on" DATE NOT NULL,
    "memo" TEXT,
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_leader_payroll_payments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "team_leader_payroll_payments_user_id_month_key_idx" ON "team_leader_payroll_payments"("user_id", "month_key");

CREATE INDEX "team_leader_payroll_payments_month_key_idx" ON "team_leader_payroll_payments"("month_key");

ALTER TABLE "team_leader_payroll_payments" ADD CONSTRAINT "team_leader_payroll_payments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "team_leader_payroll_payments" ADD CONSTRAINT "team_leader_payroll_payments_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
