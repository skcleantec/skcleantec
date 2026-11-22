-- 상담사별 대응 카드 복사 횟수
CREATE TABLE IF NOT EXISTS "telecrm_response_card_user_stats" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "copy_count" INTEGER NOT NULL DEFAULT 0,
    "last_copied_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "telecrm_response_card_user_stats_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "telecrm_response_card_user_stats_card_id_user_id_key"
  ON "telecrm_response_card_user_stats"("card_id", "user_id");
CREATE INDEX IF NOT EXISTS "telecrm_response_card_user_stats_tenant_id_user_id_idx"
  ON "telecrm_response_card_user_stats"("tenant_id", "user_id");

DO $$ BEGIN
  ALTER TABLE "telecrm_response_card_user_stats"
    ADD CONSTRAINT "telecrm_response_card_user_stats_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "telecrm_response_card_user_stats"
    ADD CONSTRAINT "telecrm_response_card_user_stats_card_id_fkey"
    FOREIGN KEY ("card_id") REFERENCES "telecrm_response_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "telecrm_response_card_user_stats"
    ADD CONSTRAINT "telecrm_response_card_user_stats_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
