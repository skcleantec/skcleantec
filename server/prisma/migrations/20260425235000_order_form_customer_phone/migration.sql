-- 발주서 발급 시 선택 입력 연락처 — 고객 공개 폼 전화란 프리필용
ALTER TABLE "order_forms" ADD COLUMN "customer_phone" TEXT;
