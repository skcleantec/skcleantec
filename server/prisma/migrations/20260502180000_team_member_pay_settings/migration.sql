-- 팀원 월급 정산(1단계): 매월 지급일·건당 책정금액
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "monthly_pay_day" INTEGER;
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "pay_amount_per_job" INTEGER;
