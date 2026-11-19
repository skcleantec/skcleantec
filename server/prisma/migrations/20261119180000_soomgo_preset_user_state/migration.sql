-- 숨고 문구: 사람별 즐겨찾기·사용 횟수
CREATE TABLE IF NOT EXISTS "telecrm_soomgo_preset_uses" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "preset_id" TEXT NOT NULL,
  "favorite" BOOLEAN NOT NULL DEFAULT false,
  "use_count" INTEGER NOT NULL DEFAULT 0,
  "last_used_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "telecrm_soomgo_preset_uses_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "telecrm_soomgo_preset_uses_tenant_id_user_id_preset_id_key"
  ON "telecrm_soomgo_preset_uses"("tenant_id", "user_id", "preset_id");
CREATE INDEX IF NOT EXISTS "telecrm_soomgo_preset_uses_tenant_id_user_id_idx"
  ON "telecrm_soomgo_preset_uses"("tenant_id", "user_id");

DO $$ BEGIN
  ALTER TABLE "telecrm_soomgo_preset_uses"
    ADD CONSTRAINT "telecrm_soomgo_preset_uses_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "telecrm_soomgo_preset_uses"
    ADD CONSTRAINT "telecrm_soomgo_preset_uses_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "telecrm_soomgo_preset_uses"
    ADD CONSTRAINT "telecrm_soomgo_preset_uses_preset_id_fkey"
    FOREIGN KEY ("preset_id") REFERENCES "telecrm_soomgo_message_presets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
