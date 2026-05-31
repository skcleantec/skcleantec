-- 모든 테넌트의 기본 발주서(1번)에 표준 항목 7종이 빠짐없이 존재하도록 보강.
-- 기존 항목은 그대로 두고(ON CONFLICT DO NOTHING), 누락된 표준 시스템 필드만 추가한다.
-- (앞선 backfill은 "필드가 하나도 없을 때만" 채웠으므로, 이미 다른 항목이 있던 기본 템플릿을 보완)

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
ON CONFLICT ("template_id","field_key") DO NOTHING;
