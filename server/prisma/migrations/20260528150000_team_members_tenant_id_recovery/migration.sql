-- Idempotent recovery: team_members.tenant_id (phase6 partial failure / prod restore 후 deploy)

ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "tenant_id" TEXT;

UPDATE "team_members" tm SET "tenant_id" = t."tenant_id"
FROM "teams" t WHERE t."id" = tm."team_id" AND tm."tenant_id" IS NULL;

UPDATE "team_members" tm SET "tenant_id" = g."tenant_id"
FROM "team_crew_group_members" cgm
JOIN "team_crew_groups" g ON g."id" = cgm."group_id"
WHERE cgm."team_member_id" = tm."id" AND tm."tenant_id" IS NULL;

UPDATE "team_members" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "team_members" WHERE "tenant_id" IS NULL) THEN
    ALTER TABLE "team_members" ALTER COLUMN "tenant_id" SET NOT NULL;
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;

CREATE INDEX IF NOT EXISTS "team_members_tenant_id_is_active_idx"
  ON "team_members"("tenant_id", "is_active");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'team_members_tenant_id_fkey'
  ) THEN
    ALTER TABLE "team_members" ADD CONSTRAINT "team_members_tenant_id_fkey"
      FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
EXCEPTION WHEN others THEN
  NULL;
END $$;
