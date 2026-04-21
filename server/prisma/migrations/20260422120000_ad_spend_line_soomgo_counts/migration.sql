-- AdSpendLine: 숨고 채널 종료 시 건수 보관 (당일 광고비 산출·이력 표시용)
ALTER TABLE "ad_spend_lines" ADD COLUMN IF NOT EXISTS "soomgo_received_count" INTEGER;
ALTER TABLE "ad_spend_lines" ADD COLUMN IF NOT EXISTS "soomgo_auto_estimate_count" INTEGER;
ALTER TABLE "ad_spend_lines" ADD COLUMN IF NOT EXISTS "soomgo_confirmed_count" INTEGER;
