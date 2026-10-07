-- 가입 때 원성이 넣는 고유번호 코드 15개. 팀장 매칭은 업체 관리자가 한다.
CREATE TABLE IF NOT EXISTS "tenant_pg_clerk_codes" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "slot_no" INTEGER NOT NULL,
    "code" VARCHAR(32) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_pg_clerk_codes_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "tenant_pg_clerk_codes_tenant_id_slot_no_key" ON "tenant_pg_clerk_codes"("tenant_id", "slot_no");
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_pg_clerk_codes_tenant_id_code_key" ON "tenant_pg_clerk_codes"("tenant_id", "code");
CREATE INDEX IF NOT EXISTS "tenant_pg_clerk_codes_tenant_id_idx" ON "tenant_pg_clerk_codes"("tenant_id");

DO $$ BEGIN
  ALTER TABLE "tenant_pg_clerk_codes" ADD CONSTRAINT "tenant_pg_clerk_codes_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "card_payments" ADD COLUMN IF NOT EXISTS "pg_clerk_code" VARCHAR(32);
