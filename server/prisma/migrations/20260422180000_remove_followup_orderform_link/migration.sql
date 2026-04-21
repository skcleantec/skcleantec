-- 부재현황 ↔ 발주서 1:1 연결 제거 (발주서 발급 화면에서 별도 처리)
ALTER TABLE "order_followups" DROP CONSTRAINT IF EXISTS "order_followups_linked_order_form_id_fkey";
DROP INDEX IF EXISTS "order_followups_linked_order_form_id_key";
ALTER TABLE "order_followups" DROP COLUMN IF EXISTS "linked_order_form_id";
