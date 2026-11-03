-- 마케터 개인 가망 표시. 골드DB와 별개.
CREATE TABLE IF NOT EXISTS "order_followup_hot_marks" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "followup_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "reason" VARCHAR(16) NOT NULL,
  "memo" TEXT,
  "next_contact_at" TIMESTAMP(3),
  "contact_tries" INTEGER NOT NULL DEFAULT 0,
  "outcome" VARCHAR(16),
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "order_followup_hot_marks_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "order_followup_hot_marks_followup_id_user_id_key"
  ON "order_followup_hot_marks"("followup_id", "user_id");
CREATE INDEX IF NOT EXISTS "order_followup_hot_marks_tenant_id_user_id_outcome_next_contact_at_idx"
  ON "order_followup_hot_marks"("tenant_id", "user_id", "outcome", "next_contact_at");

DO $$ BEGIN
  ALTER TABLE "order_followup_hot_marks" ADD CONSTRAINT "order_followup_hot_marks_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "order_followup_hot_marks" ADD CONSTRAINT "order_followup_hot_marks_followup_id_fkey"
    FOREIGN KEY ("followup_id") REFERENCES "order_followups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "order_followup_hot_marks" ADD CONSTRAINT "order_followup_hot_marks_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
