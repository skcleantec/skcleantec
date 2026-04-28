-- 고객 발주서 시간대 선택 확인 모달 문구 (관리자 편집)
ALTER TABLE "order_form_config" ADD COLUMN IF NOT EXISTS "time_slot_ack_title" TEXT;
ALTER TABLE "order_form_config" ADD COLUMN IF NOT EXISTS "time_slot_ack_body" TEXT;
ALTER TABLE "order_form_config" ADD COLUMN IF NOT EXISTS "time_slot_ack_consent_hint" TEXT;
