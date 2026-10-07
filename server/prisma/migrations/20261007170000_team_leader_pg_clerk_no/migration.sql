-- 팀장 원성 고유번호 1~15. 결제 당시 번호를 카드 결제에 남긴다.
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "pg_clerk_no" INTEGER;
CREATE UNIQUE INDEX IF NOT EXISTS "users_tenant_id_pg_clerk_no_key" ON "users" ("tenant_id", "pg_clerk_no");

ALTER TABLE "card_payments" ADD COLUMN IF NOT EXISTS "pg_clerk_no" INTEGER;
