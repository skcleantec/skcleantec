-- 부재현황: 닉네임(선택) 컬럼 추가
ALTER TABLE "order_followups" ADD COLUMN IF NOT EXISTS "nickname" TEXT;
