-- 레거시 SK 브랜드가 박힌 기본 발주서·폼 제목을 중립명으로 보정
-- (신규 시드는 이미 「입주청소 발주서」)

UPDATE "order_form_templates"
SET "title" = '입주청소 발주서'
WHERE "title" = 'SK클린텍 입주청소 발주서'
  AND "is_default" = true;

UPDATE "order_form_config"
SET "form_title" = '입주청소 발주서'
WHERE "form_title" = 'SK클린텍 입주청소 발주서';

UPDATE "order_form_brand_customer_link_configs"
SET "form_title" = '입주청소 발주서'
WHERE "form_title" = 'SK클린텍 입주청소 발주서';
