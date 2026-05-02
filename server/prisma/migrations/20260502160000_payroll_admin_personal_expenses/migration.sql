-- 급여표 지출 탭용 관리자 개인 지출 기록

CREATE TABLE "payroll_admin_personal_expenses" (
    "id" TEXT NOT NULL,
    "month_key" VARCHAR(7) NOT NULL,
    "amount" INTEGER NOT NULL,
    "memo" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_admin_personal_expenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_admin_personal_expenses_month_key_created_at_idx" ON "payroll_admin_personal_expenses"("month_key", "created_at" DESC);

ALTER TABLE "payroll_admin_personal_expenses" ADD CONSTRAINT "payroll_admin_personal_expenses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
