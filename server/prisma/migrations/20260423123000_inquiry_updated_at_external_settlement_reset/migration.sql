-- 접수 수정 시각(타업체 수수료 누적 구간용)
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
UPDATE "inquiries" SET "updated_at" = "created_at";

-- 타업체 정산 완료 후 누적 초기화 이력
CREATE TABLE IF NOT EXISTS "external_company_settlement_resets" (
    "id" TEXT NOT NULL,
    "external_company_id" TEXT NOT NULL,
    "reset_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,

    CONSTRAINT "external_company_settlement_resets_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "external_company_settlement_resets_company_reset_idx"
ON "external_company_settlement_resets" ("external_company_id", "reset_at" DESC);

DO $$
BEGIN
  ALTER TABLE "external_company_settlement_resets"
    ADD CONSTRAINT "external_company_settlement_resets_external_company_id_fkey"
    FOREIGN KEY ("external_company_id") REFERENCES "external_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "external_company_settlement_resets"
    ADD CONSTRAINT "external_company_settlement_resets_actor_id_fkey"
    FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
