-- 발주서 preferredTime SELECT 옵션에 「조율」 추가
UPDATE "order_form_template_fields"
SET "options" = '["오전","오후","사이청소","조율"]'::jsonb
WHERE "system_field" = 'preferredTime'
  AND "options"::text = '["오전","오후","사이청소"]';
