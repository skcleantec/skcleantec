-- 가맹점 계약 후 받는 MID·OID. 업체마다 따로 저장하고, 주문번호는 OID 4자리로 시작합니다.
ALTER TABLE "tenant_pg_credentials" ADD COLUMN IF NOT EXISTS "mid" VARCHAR(32);
ALTER TABLE "tenant_pg_credentials" ADD COLUMN IF NOT EXISTS "oid" VARCHAR(8);
