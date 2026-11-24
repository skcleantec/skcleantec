-- 업무 앱 입금 알림을 같은 입금에 한 번만 보내기 위한 선점 시각
ALTER TABLE "bank_deposits" ADD COLUMN IF NOT EXISTS "staff_push_claimed_at" TIMESTAMP(3);
