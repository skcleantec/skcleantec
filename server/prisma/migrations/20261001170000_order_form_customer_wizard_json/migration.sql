-- 손님 발주서 페이지 문구·선택지 (설정 화면에서 수정·추가·삭제)
ALTER TABLE "order_form_templates" ADD COLUMN IF NOT EXISTS "customer_wizard_json" JSONB;
