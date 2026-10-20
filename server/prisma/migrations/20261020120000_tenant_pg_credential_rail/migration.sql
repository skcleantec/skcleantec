-- 수기(구인증)와 링크(인증결제) 가맹 키를 업체마다 따로 둔다.
-- 기존 한 줄은 수기 칸으로 둔다.

CREATE TYPE "TenantPgRail" AS ENUM ('KEYIN', 'LINK');

ALTER TABLE "tenant_pg_credentials" ADD COLUMN "rail" "TenantPgRail" NOT NULL DEFAULT 'KEYIN';

DROP INDEX IF EXISTS "tenant_pg_credentials_tenant_id_key";

CREATE UNIQUE INDEX "tenant_pg_credentials_tenant_id_rail_key" ON "tenant_pg_credentials"("tenant_id", "rail");
