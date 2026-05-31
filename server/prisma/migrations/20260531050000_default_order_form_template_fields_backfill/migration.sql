-- 기존에 쓰던 표준 발주서를 모든 테넌트의 기본 발주서(1번)에 공통 항목으로 백필.
-- 기본 템플릿(is_default)에 항목이 하나도 없을 때만 표준 시스템 필드 7종을 채운다(idempotent).
-- 공개 화면은 시스템 필드를 표준 입력(카카오 주소검색·공급/전용 평수 등)으로 렌더하므로 고객 화면 동작은 불변.

INSERT INTO "order_form_template_fields"
  ("id","tenant_id","template_id","field_key","label","help_text","input_type","options","required","sort_order","system_field","fill_mode","created_at","updated_at")
SELECT
  gen_random_uuid()::text,
  t."tenant_id",
  t."id",
  f.field_key,
  f.label,
  NULL,
  f.input_type::"OrderFormFieldInputType",
  f.options::jsonb,
  true,
  f.sort_order,
  f.system_field,
  'CUSTOMER'::"OrderFormFieldFillMode",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "order_form_templates" t
CROSS JOIN (VALUES
  ('customerName','고객명','TEXT','[]',0,'customerName'),
  ('address','주소','ADDRESS','[]',1,'address'),
  ('customerPhone','전화번호','PHONE','[]',2,'customerPhone'),
  ('areaPyeong','평수','NUMBER','[]',3,'areaPyeong'),
  ('totalAmount','금액(총액)','MONEY','[]',4,'totalAmount'),
  ('preferredDate','희망일','DATE','[]',5,'preferredDate'),
  ('preferredTime','시간대','SELECT','["오전","오후","사이청소"]',6,'preferredTime')
) AS f(field_key, label, input_type, options, sort_order, system_field)
WHERE t."is_default" = true
  AND NOT EXISTS (
    SELECT 1 FROM "order_form_template_fields" ofx WHERE ofx."template_id" = t."id"
  );
