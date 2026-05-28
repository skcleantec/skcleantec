-- Phase 6: per-tenant configs + team_members.tenant_id
-- Default tenant id matches migrations/20260525100000_multitenant_phase1

-- order_form_config
ALTER TABLE "order_form_config" ADD COLUMN "tenant_id" TEXT;
UPDATE "order_form_config" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "order_form_config" ALTER COLUMN "tenant_id" SET NOT NULL;
CREATE UNIQUE INDEX "order_form_config_tenant_id_key" ON "order_form_config"("tenant_id");
ALTER TABLE "order_form_config" ADD CONSTRAINT "order_form_config_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- estimate_config
ALTER TABLE "estimate_config" ADD COLUMN "tenant_id" TEXT;
UPDATE "estimate_config" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "estimate_config" ALTER COLUMN "tenant_id" SET NOT NULL;
CREATE UNIQUE INDEX "estimate_config_tenant_id_key" ON "estimate_config"("tenant_id");
ALTER TABLE "estimate_config" ADD CONSTRAINT "estimate_config_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- estimate_options
ALTER TABLE "estimate_options" ADD COLUMN "tenant_id" TEXT;
UPDATE "estimate_options" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "estimate_options" ALTER COLUMN "tenant_id" SET NOT NULL;
CREATE INDEX "estimate_options_tenant_id_is_active_idx" ON "estimate_options"("tenant_id", "is_active");
ALTER TABLE "estimate_options" ADD CONSTRAINT "estimate_options_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- professional_specialty_options (composite PK)
ALTER TABLE "professional_specialty_options" ADD COLUMN "tenant_id" TEXT;
UPDATE "professional_specialty_options" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "professional_specialty_options" ALTER COLUMN "tenant_id" SET NOT NULL;

ALTER TABLE "professional_specialty_options" DROP CONSTRAINT IF EXISTS "professional_specialty_options_parent_id_fkey";
ALTER TABLE "professional_specialty_options" DROP CONSTRAINT "professional_specialty_options_pkey";
ALTER TABLE "professional_specialty_options" ADD CONSTRAINT "professional_specialty_options_pkey" PRIMARY KEY ("tenant_id", "id");
ALTER TABLE "professional_specialty_options" ADD CONSTRAINT "professional_specialty_options_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "professional_specialty_options" ADD CONSTRAINT "professional_specialty_options_tenant_id_parent_id_fkey"
  FOREIGN KEY ("tenant_id", "parent_id") REFERENCES "professional_specialty_options"("tenant_id", "id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "professional_specialty_options_tenant_id_parent_id_sort_order_idx"
  ON "professional_specialty_options"("tenant_id", "parent_id", "sort_order");

-- team_members
ALTER TABLE "team_members" ADD COLUMN "tenant_id" TEXT;
UPDATE "team_members" tm SET "tenant_id" = t."tenant_id"
FROM "teams" t WHERE t."id" = tm."team_id" AND tm."tenant_id" IS NULL;
UPDATE "team_members" tm SET "tenant_id" = g."tenant_id"
FROM "team_crew_group_members" cgm
JOIN "team_crew_groups" g ON g."id" = cgm."group_id"
WHERE cgm."team_member_id" = tm."id" AND tm."tenant_id" IS NULL;
UPDATE "team_members" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "team_members" ALTER COLUMN "tenant_id" SET NOT NULL;
CREATE INDEX "team_members_tenant_id_is_active_idx" ON "team_members"("tenant_id", "is_active");
ALTER TABLE "team_members" ADD CONSTRAINT "team_members_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
