-- Re-sync team_members.tenant_id from team / crew group (fixes P2 strict-filter regression on schedule calendar)
UPDATE "team_members" tm
SET "tenant_id" = t."tenant_id"
FROM "teams" t
WHERE t."id" = tm."team_id" AND tm."tenant_id" IS DISTINCT FROM t."tenant_id";

UPDATE "team_members" tm
SET "tenant_id" = g."tenant_id"
FROM "team_crew_group_members" cgm
JOIN "team_crew_groups" g ON g."id" = cgm."group_id"
WHERE cgm."team_member_id" = tm."id"
  AND tm."team_id" IS NULL
  AND tm."tenant_id" IS DISTINCT FROM g."tenant_id";
