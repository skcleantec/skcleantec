-- Idempotent recovery: phase6 config tables + specialty PK (P3018 / prod restore 후 deploy 실패 대비)
-- DEFAULT tenant id = migrations/20260525100000_multitenant_phase1

-- order_form_config: legacy multi-row → 1행만 유지 후 tenant_id
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "order_form_config") > 1 THEN
    DELETE FROM "order_form_config" o
    WHERE o.ctid NOT IN (SELECT MIN(o2.ctid) FROM "order_form_config" o2);
  END IF;
END $$;

ALTER TABLE "order_form_config" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "order_form_config" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "order_form_config" WHERE "tenant_id" IS NULL) THEN
    ALTER TABLE "order_form_config" ALTER COLUMN "tenant_id" SET NOT NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "order_form_config_tenant_id_key" ON "order_form_config"("tenant_id");

DO $$
BEGIN
  ALTER TABLE "order_form_config" ADD CONSTRAINT "order_form_config_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- estimate_config
DO $$
BEGIN
  IF (SELECT COUNT(*) FROM "estimate_config") > 1 THEN
    DELETE FROM "estimate_config" o
    WHERE o.ctid NOT IN (SELECT MIN(o2.ctid) FROM "estimate_config" o2);
  END IF;
END $$;

ALTER TABLE "estimate_config" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "estimate_config" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "estimate_config" WHERE "tenant_id" IS NULL) THEN
    ALTER TABLE "estimate_config" ALTER COLUMN "tenant_id" SET NOT NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "estimate_config_tenant_id_key" ON "estimate_config"("tenant_id");

DO $$
BEGIN
  ALTER TABLE "estimate_config" ADD CONSTRAINT "estimate_config_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- estimate_options
ALTER TABLE "estimate_options" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "estimate_options" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "estimate_options" WHERE "tenant_id" IS NULL) THEN
    ALTER TABLE "estimate_options" ALTER COLUMN "tenant_id" SET NOT NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "estimate_options_tenant_id_is_active_idx"
  ON "estimate_options"("tenant_id", "is_active");

DO $$
BEGIN
  ALTER TABLE "estimate_options" ADD CONSTRAINT "estimate_options_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- professional_specialty_options: tenant_id + composite PK
ALTER TABLE "professional_specialty_options" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;
UPDATE "professional_specialty_options" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "professional_specialty_options" WHERE "tenant_id" IS NULL) THEN
    ALTER TABLE "professional_specialty_options" ALTER COLUMN "tenant_id" SET NOT NULL;
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON t.oid = c.conrelid
    WHERE t.relname = 'professional_specialty_options'
      AND c.contype = 'p'
      AND pg_get_constraintdef(c.oid) LIKE '%tenant_id%'
  ) THEN
    ALTER TABLE "professional_specialty_options" DROP CONSTRAINT IF EXISTS "professional_specialty_options_parent_id_fkey";
    ALTER TABLE "professional_specialty_options" DROP CONSTRAINT IF EXISTS "professional_specialty_options_pkey";
    ALTER TABLE "professional_specialty_options"
      ADD CONSTRAINT "professional_specialty_options_pkey" PRIMARY KEY ("tenant_id", "id");
  END IF;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "professional_specialty_options" ADD CONSTRAINT "professional_specialty_options_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "professional_specialty_options" ADD CONSTRAINT "professional_specialty_options_tenant_id_parent_id_fkey"
    FOREIGN KEY ("tenant_id", "parent_id") REFERENCES "professional_specialty_options"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "professional_specialty_options_tenant_id_parent_id_sort_order_idx"
  ON "professional_specialty_options"("tenant_id", "parent_id", "sort_order");
