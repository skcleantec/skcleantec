-- Phase 4b: schedule, payroll, crew, e-contract, custom calendar tenant_id
-- Default tenant matches phase1 migration

-- schedule_day_closures
ALTER TABLE "schedule_day_closures" ADD COLUMN "tenant_id" TEXT;
UPDATE "schedule_day_closures" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "schedule_day_closures" ALTER COLUMN "tenant_id" SET NOT NULL;
DROP INDEX IF EXISTS "schedule_day_closures_date_key";
CREATE UNIQUE INDEX "schedule_day_closures_tenant_id_date_key" ON "schedule_day_closures"("tenant_id", "date");
ALTER TABLE "schedule_day_closures" ADD CONSTRAINT "schedule_day_closures_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- schedule_day_slot_to_adjustments
ALTER TABLE "schedule_day_slot_to_adjustments" ADD COLUMN "tenant_id" TEXT;
UPDATE "schedule_day_slot_to_adjustments" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "schedule_day_slot_to_adjustments" ALTER COLUMN "tenant_id" SET NOT NULL;
DROP INDEX IF EXISTS "schedule_day_slot_to_adjustments_date_key";
CREATE UNIQUE INDEX "schedule_day_slot_to_adjustments_tenant_id_date_key" ON "schedule_day_slot_to_adjustments"("tenant_id", "date");
ALTER TABLE "schedule_day_slot_to_adjustments" ADD CONSTRAINT "schedule_day_slot_to_adjustments_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- schedule_day_leader_slots
ALTER TABLE "schedule_day_leader_slots" ADD COLUMN "tenant_id" TEXT;
UPDATE "schedule_day_leader_slots" s SET "tenant_id" = u."tenant_id"
FROM "users" u WHERE u."id" = s."team_leader_id" AND s."tenant_id" IS NULL;
UPDATE "schedule_day_leader_slots" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "schedule_day_leader_slots" ALTER COLUMN "tenant_id" SET NOT NULL;
DROP INDEX IF EXISTS "schedule_day_leader_slots_date_team_leader_id_key";
CREATE UNIQUE INDEX "schedule_day_leader_slots_tenant_id_date_team_leader_id_key"
  ON "schedule_day_leader_slots"("tenant_id", "date", "team_leader_id");
ALTER TABLE "schedule_day_leader_slots" ADD CONSTRAINT "schedule_day_leader_slots_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- schedule_day_team_member_slots
ALTER TABLE "schedule_day_team_member_slots" ADD COLUMN "tenant_id" TEXT;
UPDATE "schedule_day_team_member_slots" s SET "tenant_id" = t."tenant_id"
FROM "team_members" tm
JOIN "teams" t ON t."id" = tm."team_id"
WHERE tm."id" = s."team_member_id" AND s."tenant_id" IS NULL;
UPDATE "schedule_day_team_member_slots" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "schedule_day_team_member_slots" ALTER COLUMN "tenant_id" SET NOT NULL;
DROP INDEX IF EXISTS "schedule_day_team_member_slots_date_team_member_id_key";
CREATE UNIQUE INDEX "schedule_day_team_member_slots_tenant_id_date_team_member_id_key"
  ON "schedule_day_team_member_slots"("tenant_id", "date", "team_member_id");
ALTER TABLE "schedule_day_team_member_slots" ADD CONSTRAINT "schedule_day_team_member_slots_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- team_crew_groups
ALTER TABLE "team_crew_groups" ADD COLUMN "tenant_id" TEXT;
UPDATE "team_crew_groups" g SET "tenant_id" = u."tenant_id"
FROM "team_crew_group_members" m
JOIN "team_members" tm ON tm."id" = m."team_member_id"
JOIN "teams" t ON t."id" = tm."team_id"
JOIN "users" u ON u."id" = t."team_leader_id"
WHERE m."group_id" = g."id" AND g."tenant_id" IS NULL;
UPDATE "team_crew_groups" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "team_crew_groups" ALTER COLUMN "tenant_id" SET NOT NULL;
DROP INDEX IF EXISTS "team_crew_groups_login_id_key";
CREATE UNIQUE INDEX "team_crew_groups_tenant_id_login_id_key" ON "team_crew_groups"("tenant_id", "login_id");
CREATE INDEX "team_crew_groups_tenant_id_is_active_idx" ON "team_crew_groups"("tenant_id", "is_active");
ALTER TABLE "team_crew_groups" ADD CONSTRAINT "team_crew_groups_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- payroll_admin_personal_expenses
ALTER TABLE "payroll_admin_personal_expenses" ADD COLUMN "tenant_id" TEXT;
UPDATE "payroll_admin_personal_expenses" p SET "tenant_id" = u."tenant_id"
FROM "users" u WHERE u."id" = p."created_by_id" AND p."tenant_id" IS NULL;
UPDATE "payroll_admin_personal_expenses" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "payroll_admin_personal_expenses" ALTER COLUMN "tenant_id" SET NOT NULL;
DROP INDEX IF EXISTS "payroll_admin_personal_expenses_month_key_created_at_idx";
CREATE INDEX "payroll_admin_personal_expenses_tenant_id_month_key_created_at_idx"
  ON "payroll_admin_personal_expenses"("tenant_id", "month_key", "created_at" DESC);
ALTER TABLE "payroll_admin_personal_expenses" ADD CONSTRAINT "payroll_admin_personal_expenses_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- payroll_admin_shared_expenses
ALTER TABLE "payroll_admin_shared_expenses" ADD COLUMN "tenant_id" TEXT;
UPDATE "payroll_admin_shared_expenses" p SET "tenant_id" = u."tenant_id"
FROM "users" u WHERE u."id" = p."created_by_id" AND p."tenant_id" IS NULL;
UPDATE "payroll_admin_shared_expenses" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "payroll_admin_shared_expenses" ALTER COLUMN "tenant_id" SET NOT NULL;
DROP INDEX IF EXISTS "payroll_admin_shared_expenses_month_key_created_at_idx";
CREATE INDEX "payroll_admin_shared_expenses_tenant_id_month_key_created_at_idx"
  ON "payroll_admin_shared_expenses"("tenant_id", "month_key", "created_at" DESC);
ALTER TABLE "payroll_admin_shared_expenses" ADD CONSTRAINT "payroll_admin_shared_expenses_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- payroll_income_deposits
ALTER TABLE "payroll_income_deposits" ADD COLUMN "tenant_id" TEXT;
UPDATE "payroll_income_deposits" p SET "tenant_id" = u."tenant_id"
FROM "users" u WHERE u."id" = p."created_by_id" AND p."tenant_id" IS NULL;
UPDATE "payroll_income_deposits" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "payroll_income_deposits" ALTER COLUMN "tenant_id" SET NOT NULL;
DROP INDEX IF EXISTS "payroll_income_deposits_month_key_deposited_on_idx";
CREATE INDEX "payroll_income_deposits_tenant_id_month_key_deposited_on_idx"
  ON "payroll_income_deposits"("tenant_id", "month_key", "deposited_on" DESC);
ALTER TABLE "payroll_income_deposits" ADD CONSTRAINT "payroll_income_deposits_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- payroll_account_ledger_manual_entries
ALTER TABLE "payroll_account_ledger_manual_entries" ADD COLUMN "tenant_id" TEXT;
UPDATE "payroll_account_ledger_manual_entries" p SET "tenant_id" = u."tenant_id"
FROM "users" u WHERE u."id" = p."created_by_id" AND p."tenant_id" IS NULL;
UPDATE "payroll_account_ledger_manual_entries" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "payroll_account_ledger_manual_entries" ALTER COLUMN "tenant_id" SET NOT NULL;
DROP INDEX IF EXISTS "pld_manual_month_pool_idx";
DROP INDEX IF EXISTS "pld_manual_month_user_idx";
DROP INDEX IF EXISTS "payroll_account_ledger_manual_entries_month_key_occurred_on_created_at_idx";
CREATE INDEX "pld_manual_month_pool_idx" ON "payroll_account_ledger_manual_entries"("tenant_id", "month_key", "payroll_link_kind", "link_team_member_id");
CREATE INDEX "pld_manual_month_user_idx" ON "payroll_account_ledger_manual_entries"("tenant_id", "month_key", "payroll_link_kind", "link_user_id");
CREATE INDEX "payroll_account_ledger_manual_entries_tenant_id_month_key_occurred_on_created_at_idx"
  ON "payroll_account_ledger_manual_entries"("tenant_id", "month_key", "occurred_on" ASC, "created_at" ASC);
ALTER TABLE "payroll_account_ledger_manual_entries" ADD CONSTRAINT "payroll_account_ledger_manual_entries_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- user_custom_calendars
ALTER TABLE "user_custom_calendars" ADD COLUMN "tenant_id" TEXT;
UPDATE "user_custom_calendars" c SET "tenant_id" = u."tenant_id"
FROM "users" u WHERE u."id" = c."user_id" AND c."tenant_id" IS NULL;
UPDATE "user_custom_calendars" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "user_custom_calendars" ALTER COLUMN "tenant_id" SET NOT NULL;
DROP INDEX IF EXISTS "user_custom_calendars_user_id_sort_order_idx";
CREATE INDEX "user_custom_calendars_tenant_id_user_id_sort_order_idx"
  ON "user_custom_calendars"("tenant_id", "user_id", "sort_order");
ALTER TABLE "user_custom_calendars" ADD CONSTRAINT "user_custom_calendars_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- e_contract_issuer_profiles
ALTER TABLE "e_contract_issuer_profiles" ADD COLUMN "tenant_id" TEXT;
UPDATE "e_contract_issuer_profiles" p SET "tenant_id" = u."tenant_id"
FROM "users" u WHERE u."id" = p."updated_by_id" AND p."tenant_id" IS NULL;
UPDATE "e_contract_issuer_profiles" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "e_contract_issuer_profiles" ALTER COLUMN "tenant_id" SET NOT NULL;
DROP INDEX IF EXISTS "e_contract_issuer_profiles_profile_key_key";
CREATE UNIQUE INDEX "e_contract_issuer_profiles_tenant_id_profile_key_key"
  ON "e_contract_issuer_profiles"("tenant_id", "profile_key");
ALTER TABLE "e_contract_issuer_profiles" ADD CONSTRAINT "e_contract_issuer_profiles_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- e_contract_field_definitions
ALTER TABLE "e_contract_field_definitions" ADD COLUMN "tenant_id" TEXT;
UPDATE "e_contract_field_definitions" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "e_contract_field_definitions" ALTER COLUMN "tenant_id" SET NOT NULL;
DROP INDEX IF EXISTS "e_contract_field_definitions_audience_token_key";
DROP INDEX IF EXISTS "e_contract_field_definitions_audience_is_active_sort_order_idx";
CREATE UNIQUE INDEX "e_contract_field_definitions_tenant_id_audience_token_key"
  ON "e_contract_field_definitions"("tenant_id", "audience", "token");
CREATE INDEX "e_contract_field_definitions_tenant_id_audience_is_active_sort_order_idx"
  ON "e_contract_field_definitions"("tenant_id", "audience", "is_active", "sort_order");
ALTER TABLE "e_contract_field_definitions" ADD CONSTRAINT "e_contract_field_definitions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- e_contract_definitions
ALTER TABLE "e_contract_definitions" ADD COLUMN "tenant_id" TEXT;
UPDATE "e_contract_definitions" d SET "tenant_id" = u."tenant_id"
FROM "users" u WHERE u."id" = d."created_by_id" AND d."tenant_id" IS NULL;
UPDATE "e_contract_definitions" SET "tenant_id" = 'a0000000-0000-4000-8000-000000000001' WHERE "tenant_id" IS NULL;
ALTER TABLE "e_contract_definitions" ALTER COLUMN "tenant_id" SET NOT NULL;
DROP INDEX IF EXISTS "e_contract_definitions_is_archived_updated_at_idx";
CREATE INDEX "e_contract_definitions_tenant_id_is_archived_updated_at_idx"
  ON "e_contract_definitions"("tenant_id", "is_archived", "updated_at" DESC);
ALTER TABLE "e_contract_definitions" ADD CONSTRAINT "e_contract_definitions_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
