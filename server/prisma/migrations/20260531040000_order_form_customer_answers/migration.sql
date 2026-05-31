-- 동적 발주서: 템플릿 추가 항목(systemField 미연결)의 고객 답변 저장 컬럼
ALTER TABLE "order_forms" ADD COLUMN IF NOT EXISTS "customer_answers" JSONB;
