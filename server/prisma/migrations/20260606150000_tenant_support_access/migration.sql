-- 플랫폼 운영 — 모든 테넌트 /admin 지원 접속 계정

CREATE TABLE "tenant_support_access" (
    "id" TEXT NOT NULL,
    "login_id" VARCHAR(48) NOT NULL,
    "password_hash" TEXT NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "memo" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_support_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenant_support_access_login_id_key" ON "tenant_support_access"("login_id");

ALTER TABLE "users" ADD COLUMN "platform_support_access_id" TEXT;

CREATE UNIQUE INDEX "users_tenant_id_platform_support_access_id_key" ON "users"("tenant_id", "platform_support_access_id");
CREATE INDEX "users_platform_support_access_id_idx" ON "users"("platform_support_access_id");

ALTER TABLE "users" ADD CONSTRAINT "users_platform_support_access_id_fkey" FOREIGN KEY ("platform_support_access_id") REFERENCES "tenant_support_access"("id") ON DELETE SET NULL ON UPDATE CASCADE;
