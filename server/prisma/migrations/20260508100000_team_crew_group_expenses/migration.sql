-- 크루 그룹 팀원 월별 지출·첨부 (이전에 db push 로만 반영되던 테이블을 마이그레이션에 편입)
-- IF NOT EXISTS / duplicate_object: 운영·스테이징 등 이미 테이블이 있는 DB에서도 deploy 가 실패하지 않게 함

CREATE TABLE IF NOT EXISTS "team_crew_group_expenses" (
    "id" TEXT NOT NULL,
    "crew_group_id" TEXT NOT NULL,
    "team_member_id" TEXT NOT NULL,
    "month_key" VARCHAR(7) NOT NULL,
    "amount" INTEGER NOT NULL,
    "memo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "team_crew_group_expenses_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "team_crew_group_expense_attachments" (
    "id" TEXT NOT NULL,
    "expense_id" TEXT NOT NULL,
    "cloudinary_public_id" VARCHAR(512) NOT NULL,
    "secure_url" VARCHAR(2048) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "team_crew_group_expense_attachments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "team_crew_group_expenses_crew_group_id_month_key_idx" ON "team_crew_group_expenses"("crew_group_id", "month_key");
CREATE INDEX IF NOT EXISTS "team_crew_group_expenses_team_member_id_month_key_idx" ON "team_crew_group_expenses"("team_member_id", "month_key");
CREATE INDEX IF NOT EXISTS "team_crew_group_expense_attachments_expense_id_idx" ON "team_crew_group_expense_attachments"("expense_id");

DO $$
BEGIN
  ALTER TABLE "team_crew_group_expenses" ADD CONSTRAINT "team_crew_group_expenses_crew_group_id_fkey" FOREIGN KEY ("crew_group_id") REFERENCES "team_crew_groups"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "team_crew_group_expenses" ADD CONSTRAINT "team_crew_group_expenses_team_member_id_fkey" FOREIGN KEY ("team_member_id") REFERENCES "team_members"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "team_crew_group_expense_attachments" ADD CONSTRAINT "team_crew_group_expense_attachments_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "team_crew_group_expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
