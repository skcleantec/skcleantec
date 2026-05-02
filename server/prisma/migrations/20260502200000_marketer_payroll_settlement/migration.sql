-- CreateTable
CREATE TABLE "marketer_payroll_settlements" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "month_key" VARCHAR(7) NOT NULL,
    "opening_carry_forward" INTEGER NOT NULL,
    "scheduled_monthly_salary" INTEGER,
    "settled_amount" INTEGER NOT NULL,
    "memo" TEXT,
    "settled_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,

    CONSTRAINT "marketer_payroll_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "marketer_payroll_settlements_user_id_month_key_key" ON "marketer_payroll_settlements"("user_id", "month_key");

-- CreateIndex
CREATE INDEX "marketer_payroll_settlements_user_id_settled_at_idx" ON "marketer_payroll_settlements"("user_id", "settled_at" DESC);

-- AddForeignKey
ALTER TABLE "marketer_payroll_settlements" ADD CONSTRAINT "marketer_payroll_settlements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "marketer_payroll_settlements" ADD CONSTRAINT "marketer_payroll_settlements_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
