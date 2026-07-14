-- 미결재(독촉) 팝업 문구 — 플랫폼 설정
ALTER TABLE "platform_billing_settings" ADD COLUMN IF NOT EXISTS "dunning_popup_title" VARCHAR(128);
ALTER TABLE "platform_billing_settings" ADD COLUMN IF NOT EXISTS "dunning_popup_subtitle" VARCHAR(256);
ALTER TABLE "platform_billing_settings" ADD COLUMN IF NOT EXISTS "dunning_popup_body" TEXT;
ALTER TABLE "platform_billing_settings" ADD COLUMN IF NOT EXISTS "dunning_block_soon_text" VARCHAR(256);
ALTER TABLE "platform_billing_settings" ADD COLUMN IF NOT EXISTS "dunning_block_today_text" VARCHAR(256);
