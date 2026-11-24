-- 입금 예약취소, 휴무 팀장에게 주인 없는 입금을 묻지 않기
ALTER TABLE "bank_deposits" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);
ALTER TABLE "bank_deposits" ADD COLUMN IF NOT EXISTS "cancelled_by_user_id" TEXT;
ALTER TABLE "bank_deposits" ADD COLUMN IF NOT EXISTS "cancelled_by" VARCHAR(16);
ALTER TABLE "bank_deposits" ADD COLUMN IF NOT EXISTS "cancel_prev_status" VARCHAR(20);

DO $$ BEGIN
  ALTER TABLE "bank_deposits" ADD CONSTRAINT "bank_deposits_cancelled_by_user_id_fkey"
    FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE "bank_deposit_settings" ADD COLUMN IF NOT EXISTS "skip_day_off_leaders" BOOLEAN NOT NULL DEFAULT true;
