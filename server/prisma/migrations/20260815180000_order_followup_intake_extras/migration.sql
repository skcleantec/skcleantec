-- 부재·보류(OrderFollowup) — CRM 추가 필드(주소·평수·구조) 저장
ALTER TABLE "order_followups" ADD COLUMN IF NOT EXISTS "address" TEXT;
ALTER TABLE "order_followups" ADD COLUMN IF NOT EXISTS "area_pyeong" DOUBLE PRECISION;
ALTER TABLE "order_followups" ADD COLUMN IF NOT EXISTS "room_count" INTEGER;
ALTER TABLE "order_followups" ADD COLUMN IF NOT EXISTS "bathroom_count" INTEGER;
ALTER TABLE "order_followups" ADD COLUMN IF NOT EXISTS "balcony_count" INTEGER;
