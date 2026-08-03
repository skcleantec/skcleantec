-- 고객 링크 메시지 블록 순서 (JSON string[])
ALTER TABLE "order_form_config"
  ADD COLUMN IF NOT EXISTS "customer_link_block_order" JSONB;

ALTER TABLE "order_form_brand_customer_link_configs"
  ADD COLUMN IF NOT EXISTS "customer_link_block_order" JSONB;
