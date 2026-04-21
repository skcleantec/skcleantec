-- 골드DB: 고급 DB 전까지 추가 관리가 필요한 건 표시
ALTER TABLE "order_followups" ADD COLUMN IF NOT EXISTS "gold_db" BOOLEAN NOT NULL DEFAULT false;
