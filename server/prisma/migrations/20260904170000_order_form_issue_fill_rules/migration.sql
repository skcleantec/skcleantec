-- AlterTable
ALTER TABLE "order_form_config" ADD COLUMN IF NOT EXISTS "issue_fill_rules" JSONB;
