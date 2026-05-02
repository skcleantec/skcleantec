-- 관리자 월급표용 — 로그인 계정(팀장·마케터) 고정 급여 필드
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "payroll_monthly_salary" INTEGER;
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "payroll_pay_day" INTEGER;
