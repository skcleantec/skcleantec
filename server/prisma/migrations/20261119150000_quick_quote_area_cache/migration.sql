-- 견적 도우미: 주소·면적 조회 결과 30일 보관, 업체당 하루 조회 횟수
CREATE TABLE IF NOT EXISTS "quick_quote_area_caches" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "cache_key" VARCHAR(64) NOT NULL,
  "payload" JSONB NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quick_quote_area_caches_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "quick_quote_area_caches_tenant_id_cache_key_key"
  ON "quick_quote_area_caches"("tenant_id", "cache_key");
CREATE INDEX IF NOT EXISTS "quick_quote_area_caches_tenant_id_expires_at_idx"
  ON "quick_quote_area_caches"("tenant_id", "expires_at");

CREATE TABLE IF NOT EXISTS "quick_quote_lookup_days" (
  "tenant_id" TEXT NOT NULL,
  "day_key" VARCHAR(10) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "quick_quote_lookup_days_pkey" PRIMARY KEY ("tenant_id", "day_key")
);
