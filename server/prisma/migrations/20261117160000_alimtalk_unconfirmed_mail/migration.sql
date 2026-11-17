-- 결과 미확정 운영 메일에 넣은 시각. 재배포 후에도 같은 발송은 다시 보내지 않는다.

ALTER TABLE "alimtalk_send_logs"
  ADD COLUMN IF NOT EXISTS "unconfirmed_mail_at" TIMESTAMP(3);
