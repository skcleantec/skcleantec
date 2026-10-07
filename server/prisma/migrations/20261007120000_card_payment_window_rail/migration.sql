-- 인증 결제창(페이시스)과 수기를 한 결제 건에서 구분한다. 카드번호 원문은 저장하지 않는다.
ALTER TABLE "card_payments" ADD COLUMN IF NOT EXISTS "pay_rail" VARCHAR(16) NOT NULL DEFAULT 'KEYIN';
ALTER TABLE "card_payments" ADD COLUMN IF NOT EXISTS "pay_screen" VARCHAR(1);
ALTER TABLE "card_payments" ADD COLUMN IF NOT EXISTS "pg_mid" VARCHAR(16);
