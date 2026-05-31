-- 발주서 발급/수정 시 마케터 선입력 값(잠금 대상) 저장
ALTER TABLE "order_forms"
  ADD COLUMN IF NOT EXISTS "prefill_answers" JSONB;
