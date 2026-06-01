-- AlterTable: 접수 변경 이력 알림용 마지막 확인 시각
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "change_log_seen_at" TIMESTAMP(3);
