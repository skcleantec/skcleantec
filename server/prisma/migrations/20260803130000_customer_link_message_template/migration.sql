-- 고객 링크 메시지 자유 편집 본문
ALTER TABLE "order_form_config"
  ADD COLUMN IF NOT EXISTS "customer_link_message_template" TEXT;

ALTER TABLE "order_form_brand_customer_link_configs"
  ADD COLUMN IF NOT EXISTS "customer_link_message_template" TEXT;
