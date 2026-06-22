-- 고객 발주서 링크 안내 메시지 문구(링크 URL 제외) 테넌트별 설정
ALTER TABLE "order_form_config" ADD COLUMN IF NOT EXISTS "customer_link_total_line" TEXT;
ALTER TABLE "order_form_config" ADD COLUMN IF NOT EXISTS "customer_link_balance_line" TEXT;
ALTER TABLE "order_form_config" ADD COLUMN IF NOT EXISTS "customer_link_schedule_line" TEXT;
ALTER TABLE "order_form_config" ADD COLUMN IF NOT EXISTS "customer_link_time_detail_line" TEXT;
ALTER TABLE "order_form_config" ADD COLUMN IF NOT EXISTS "customer_link_order_intro" TEXT;
ALTER TABLE "order_form_config" ADD COLUMN IF NOT EXISTS "customer_link_cs_notice" TEXT;
ALTER TABLE "order_form_config" ADD COLUMN IF NOT EXISTS "customer_link_cs_url_label" TEXT;
ALTER TABLE "order_form_config" ADD COLUMN IF NOT EXISTS "customer_link_payback_block" TEXT;
