-- 끊김 알림을 보낸 폰이 다시 연결됐을 때 한 번만 알리기 위한 시각
ALTER TABLE "bank_deposit_devices" ADD COLUMN IF NOT EXISTS "alert_recovered_at" TIMESTAMP(3);
