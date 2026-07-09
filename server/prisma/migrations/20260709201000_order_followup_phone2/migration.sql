-- 부재현황 — 안심번호(보조 연락처) Inquiry와 동일 필드
ALTER TABLE "order_followups" ADD COLUMN "customer_phone_2" TEXT;
