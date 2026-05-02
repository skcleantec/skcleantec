-- 급여표 정산 탭용 관리자 공용 지출 기록

CREATE TABLE "payroll_admin_shared_expenses" (
    "id" TEXT NOT NULL,
    "month_key" VARCHAR(7) NOT NULL,
    "amount" INTEGER NOT NULL,
    "memo" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_admin_shared_expenses_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_admin_shared_expenses_month_key_created_at_idx" ON "payroll_admin_shared_expenses"("month_key", "created_at" DESC);

ALTER TABLE "payroll_admin_shared_expenses" ADD CONSTRAINT "payroll_admin_shared_expenses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
