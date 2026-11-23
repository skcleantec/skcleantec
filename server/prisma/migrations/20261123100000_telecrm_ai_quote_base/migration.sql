-- 텔레CRM AI 견적 기준표 · 상담사가 보낸 견적 보정
CREATE TABLE IF NOT EXISTS "telecrm_ai_quote_base_rows" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "type_group" VARCHAR(16),
    "one_room_like" BOOLEAN,
    "or_one_room" BOOLEAN NOT NULL DEFAULT false,
    "rooms_min" INTEGER,
    "rooms_max" INTEGER,
    "baths_min" INTEGER,
    "baths_max" INTEGER,
    "balconies_min" INTEGER,
    "balconies_max" INTEGER,
    "pyeong_min" INTEGER,
    "pyeong_max" INTEGER,
    "kind" VARCHAR(16) NOT NULL,
    "amount_won" INTEGER NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telecrm_ai_quote_base_rows_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "telecrm_ai_quote_base_rows_tenant_id_sort_order_idx"
  ON "telecrm_ai_quote_base_rows"("tenant_id", "sort_order");

DO $$ BEGIN
  ALTER TABLE "telecrm_ai_quote_base_rows"
    ADD CONSTRAINT "telecrm_ai_quote_base_rows_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "telecrm_ai_quote_corrections" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "quote_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type_group" VARCHAR(16),
    "is_one_room_like" BOOLEAN NOT NULL,
    "rooms" INTEGER,
    "baths" INTEGER,
    "balconies" INTEGER,
    "pyeong" INTEGER NOT NULL,
    "ai_amount_won" INTEGER NOT NULL,
    "sent_base_amount_won" INTEGER NOT NULL,
    "base_row_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telecrm_ai_quote_corrections_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "telecrm_ai_quote_corrections_quote_id_key"
  ON "telecrm_ai_quote_corrections"("quote_id");
CREATE INDEX IF NOT EXISTS "telecrm_ai_quote_corrections_tenant_id_operating_company_id_type_group_pyeong_created_at_idx"
  ON "telecrm_ai_quote_corrections"("tenant_id", "operating_company_id", "type_group", "pyeong", "created_at");
CREATE INDEX IF NOT EXISTS "telecrm_ai_quote_corrections_tenant_id_base_row_id_created_at_idx"
  ON "telecrm_ai_quote_corrections"("tenant_id", "base_row_id", "created_at");

DO $$ BEGIN
  ALTER TABLE "telecrm_ai_quote_corrections"
    ADD CONSTRAINT "telecrm_ai_quote_corrections_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "telecrm_ai_quote_corrections"
    ADD CONSTRAINT "telecrm_ai_quote_corrections_operating_company_id_fkey"
    FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "telecrm_ai_quote_corrections"
    ADD CONSTRAINT "telecrm_ai_quote_corrections_quote_id_fkey"
    FOREIGN KEY ("quote_id") REFERENCES "telecrm_consultation_quotes"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "telecrm_ai_quote_corrections"
    ADD CONSTRAINT "telecrm_ai_quote_corrections_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "telecrm_ai_quote_corrections"
    ADD CONSTRAINT "telecrm_ai_quote_corrections_base_row_id_fkey"
    FOREIGN KEY ("base_row_id") REFERENCES "telecrm_ai_quote_base_rows"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "telecrm_ai_quote_correction_dismissals" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "base_row_id" TEXT NOT NULL,
    "sent_amount_won" INTEGER NOT NULL,
    "until" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "telecrm_ai_quote_correction_dismissals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "telecrm_ai_quote_correction_dismissals_tenant_id_base_row_id_sent_amount_won_key"
  ON "telecrm_ai_quote_correction_dismissals"("tenant_id", "base_row_id", "sent_amount_won");

DO $$ BEGIN
  ALTER TABLE "telecrm_ai_quote_correction_dismissals"
    ADD CONSTRAINT "telecrm_ai_quote_correction_dismissals_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "telecrm_ai_quote_correction_dismissals"
    ADD CONSTRAINT "telecrm_ai_quote_correction_dismissals_base_row_id_fkey"
    FOREIGN KEY ("base_row_id") REFERENCES "telecrm_ai_quote_base_rows"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 업체 코드 sk 에만 8줄. 이미 한 줄이라도 있으면 건드리지 않음.
INSERT INTO "telecrm_ai_quote_base_rows" (
  "id", "tenant_id", "sort_order", "is_active", "type_group", "one_room_like", "or_one_room",
  "rooms_min", "rooms_max", "baths_min", "baths_max", "balconies_min", "balconies_max",
  "pyeong_min", "pyeong_max", "kind", "amount_won", "label", "created_at", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  t.id,
  s.sort_order,
  true,
  s.type_group,
  NULL,
  s.or_one_room,
  s.rooms_min,
  s.rooms_max,
  s.baths_min,
  s.baths_max,
  s.balconies_min,
  s.balconies_max,
  s.pyeong_min,
  s.pyeong_max,
  s.kind,
  s.amount_won,
  s.label,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "tenants" t
CROSS JOIN (
  VALUES
    (1, 'small', false, NULL::int, NULL::int, NULL::int, NULL::int, NULL::int, NULL::int, NULL::int, 20, 'fixed', 150000, '20평 이하 → 15만 고정'),
    (2, 'small', false, NULL::int, NULL::int, NULL::int, NULL::int, NULL::int, NULL::int, 21, NULL::int, 'perPyeong', 10000, '21평 이상 → 평당 1만'),
    (3, 'general', true, NULL::int, 2, NULL::int, 1, NULL::int, 1, NULL::int, 22, 'fixed', 200000, '22평 이하 → 20만 고정'),
    (4, 'general', false, 2, 2, NULL::int, NULL::int, NULL::int, NULL::int, 23, NULL::int, 'perPyeong', 10000, '23평 이상 → 평당 1만'),
    (5, 'general', false, 3, 3, NULL::int, 1, NULL::int, 1, NULL::int, 24, 'fixed', 240000, '24평 이하 → 24만 고정'),
    (6, 'general', false, 3, 3, NULL::int, 1, NULL::int, 1, 25, NULL::int, 'perPyeong', 10000, '25평 이상 → 평당 1만'),
    (7, 'general', false, 3, NULL::int, 1, 2, 1, 5, NULL::int, 25, 'fixed', 250000, '25평 이하 → 25만 고정'),
    (8, 'general', false, 3, NULL::int, 1, 2, 1, 5, 26, NULL::int, 'perPyeong', 10000, '26평 이상 → 평당 1만')
) AS s(
  sort_order, type_group, or_one_room,
  rooms_min, rooms_max, baths_min, baths_max, balconies_min, balconies_max,
  pyeong_min, pyeong_max, kind, amount_won, label
)
WHERE t.slug = 'sk'
  AND NOT EXISTS (
    SELECT 1 FROM "telecrm_ai_quote_base_rows" b WHERE b.tenant_id = t.id
  );
