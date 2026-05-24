-- Phase 4: core business tables tenant_id + daily_inquiry_counters composite PK
-- Default tenant id matches migrations/20260525100000_multitenant_phase1

-- external_companies
ALTER TABLE "external_companies" ADD COLUMN "tenant_id" TEXT;
UPDATE "external_companies" ec
SET "tenant_id" = u."tenant_id"
FROM "users" u
WHERE u."external_company_id" = ec."id" AND ec."tenant_id" IS NULL;
UPDATE "external_companies" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "external_companies" ALTER COLUMN "tenant_id" SET NOT NULL;
CREATE INDEX "external_companies_tenant_id_is_active_idx" ON "external_companies"("tenant_id", "is_active");
ALTER TABLE "external_companies" ADD CONSTRAINT "external_companies_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- teams
ALTER TABLE "teams" ADD COLUMN "tenant_id" TEXT;
UPDATE "teams" t SET "tenant_id" = u."tenant_id"
FROM "users" u WHERE u."id" = t."team_leader_id" AND t."tenant_id" IS NULL;
UPDATE "teams" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "teams" ALTER COLUMN "tenant_id" SET NOT NULL;
CREATE INDEX "teams_tenant_id_idx" ON "teams"("tenant_id");
ALTER TABLE "teams" ADD CONSTRAINT "teams_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- order_forms
ALTER TABLE "order_forms" ADD COLUMN "tenant_id" TEXT;
UPDATE "order_forms" o SET "tenant_id" = u."tenant_id"
FROM "users" u WHERE u."id" = o."created_by_id" AND o."tenant_id" IS NULL;
UPDATE "order_forms" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "order_forms" ALTER COLUMN "tenant_id" SET NOT NULL;
CREATE INDEX "order_forms_tenant_id_created_at_idx" ON "order_forms"("tenant_id", "created_at" DESC);
ALTER TABLE "order_forms" ADD CONSTRAINT "order_forms_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- assignments
ALTER TABLE "assignments" ADD COLUMN "tenant_id" TEXT;
UPDATE "assignments" a SET "tenant_id" = i."tenant_id"
FROM "inquiries" i WHERE i."id" = a."inquiry_id" AND a."tenant_id" IS NULL;
UPDATE "assignments" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "assignments" ALTER COLUMN "tenant_id" SET NOT NULL;
CREATE INDEX "assignments_tenant_id_inquiry_id_idx" ON "assignments"("tenant_id", "inquiry_id");
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- messages
ALTER TABLE "messages" ADD COLUMN "tenant_id" TEXT;
UPDATE "messages" m SET "tenant_id" = u."tenant_id"
FROM "users" u WHERE u."id" = m."sender_id" AND m."tenant_id" IS NULL;
UPDATE "messages" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "messages" ALTER COLUMN "tenant_id" SET NOT NULL;
CREATE INDEX "messages_tenant_id_receiver_id_read_at_idx" ON "messages"("tenant_id", "receiver_id", "read_at");
ALTER TABLE "messages" ADD CONSTRAINT "messages_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- cs_reports
ALTER TABLE "cs_reports" ADD COLUMN "tenant_id" TEXT;
UPDATE "cs_reports" c SET "tenant_id" = i."tenant_id"
FROM "inquiries" i WHERE i."id" = c."inquiry_id" AND c."tenant_id" IS NULL;
UPDATE "cs_reports" c SET "tenant_id" = u."tenant_id"
FROM "users" u WHERE u."id" = c."completed_by_id" AND c."tenant_id" IS NULL;
UPDATE "cs_reports" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "cs_reports" ALTER COLUMN "tenant_id" SET NOT NULL;
CREATE INDEX "cs_reports_tenant_id_created_at_idx" ON "cs_reports"("tenant_id", "created_at");
ALTER TABLE "cs_reports" ADD CONSTRAINT "cs_reports_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- order_followups
ALTER TABLE "order_followups" ADD COLUMN "tenant_id" TEXT;
UPDATE "order_followups" f SET "tenant_id" = i."tenant_id"
FROM "inquiries" i WHERE i."id" = f."inquiry_id" AND f."tenant_id" IS NULL;
UPDATE "order_followups" f SET "tenant_id" = u."tenant_id"
FROM "users" u WHERE u."id" = f."created_by_id" AND f."tenant_id" IS NULL;
UPDATE "order_followups" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "order_followups" ALTER COLUMN "tenant_id" SET NOT NULL;
CREATE INDEX "order_followups_tenant_id_status_updated_at_idx" ON "order_followups"("tenant_id", "status", "updated_at");
ALTER TABLE "order_followups" ADD CONSTRAINT "order_followups_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ad_channels
ALTER TABLE "ad_channels" ADD COLUMN "tenant_id" TEXT;
UPDATE "ad_channels" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "ad_channels" ALTER COLUMN "tenant_id" SET NOT NULL;
CREATE INDEX "ad_channels_tenant_id_sort_order_idx" ON "ad_channels"("tenant_id", "sort_order");
ALTER TABLE "ad_channels" ADD CONSTRAINT "ad_channels_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ad_work_sessions
ALTER TABLE "ad_work_sessions" ADD COLUMN "tenant_id" TEXT;
UPDATE "ad_work_sessions" s SET "tenant_id" = u."tenant_id"
FROM "users" u WHERE u."id" = s."user_id" AND s."tenant_id" IS NULL;
UPDATE "ad_work_sessions" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "ad_work_sessions" ALTER COLUMN "tenant_id" SET NOT NULL;
CREATE INDEX "ad_work_sessions_tenant_id_user_id_started_at_idx" ON "ad_work_sessions"("tenant_id", "user_id", "started_at");
ALTER TABLE "ad_work_sessions" ADD CONSTRAINT "ad_work_sessions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- daily_inquiry_counters: PK (tenant_id, date_key)
ALTER TABLE "daily_inquiry_counters" ADD COLUMN "tenant_id" TEXT;
UPDATE "daily_inquiry_counters" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "daily_inquiry_counters" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "daily_inquiry_counters" DROP CONSTRAINT "daily_inquiry_counters_pkey";
ALTER TABLE "daily_inquiry_counters" ADD CONSTRAINT "daily_inquiry_counters_pkey" PRIMARY KEY ("tenant_id", "date_key");
ALTER TABLE "daily_inquiry_counters" ADD CONSTRAINT "daily_inquiry_counters_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
