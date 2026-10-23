-- PG 신청 알림 수신 메일. 기본은 wsgpay@naver.com. 원성 화면에서 더 넣을 수 있다.

ALTER TABLE "platform_card_payment_settings"
  ADD COLUMN "pg_application_notify_emails" JSONB NOT NULL DEFAULT '["wsgpay@naver.com"]';
