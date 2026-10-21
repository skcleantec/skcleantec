-- 원성 고유번호 15칸은 누가 결재했는지 구분에 쓰지 않는다. 결재자는 created_by만 남긴다.
DROP TABLE IF EXISTS "tenant_pg_clerk_codes";

DROP INDEX IF EXISTS "users_tenant_id_pg_clerk_no_key";
ALTER TABLE "users" DROP COLUMN IF EXISTS "pg_clerk_no";

ALTER TABLE "card_payments" DROP COLUMN IF EXISTS "pg_clerk_no";
ALTER TABLE "card_payments" DROP COLUMN IF EXISTS "pg_clerk_code";
