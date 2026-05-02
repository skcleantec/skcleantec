-- 급여표 정산 탭 수입 영역 — 귀속 월별 입금 기록(참고용)

CREATE TABLE "payroll_income_deposits" (
    "id" TEXT NOT NULL,
    "month_key" VARCHAR(7) NOT NULL,
    "deposited_on" DATE NOT NULL,
    "amount" INTEGER NOT NULL,
    "memo" TEXT,
    "created_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payroll_income_deposits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "payroll_income_deposits_month_key_deposited_on_idx" ON "payroll_income_deposits"("month_key", "deposited_on" DESC);

ALTER TABLE "payroll_income_deposits" ADD CONSTRAINT "payroll_income_deposits_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
