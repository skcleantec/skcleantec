-- A안: 빌더에서 선택 표준항목(구체적 시각·방/베란다/화장실/주방·특이사항)을 표시/숨김 제어할 수 있도록,
-- 모든 테넌트의 기본 발주서(1번)에 해당 선택 표준항목을 공통으로 채운다(이미 있으면 보존).
-- 공개 폼은 이 항목이 템플릿에 있으면 해당 표준 섹션을 표시 → 기본 발주서는 기존과 동일하게 전부 표시(회귀 방지).

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
  '[]'::jsonb,
  false,
  f.sort_order,
  f.system_field,
  'CUSTOMER'::"OrderFormFieldFillMode",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "order_form_templates" t
CROSS JOIN (VALUES
  ('preferredTimeDetail','구체적 시각','TEXT',7,'preferredTimeDetail'),
  ('roomCount','방 개수','NUMBER',8,'roomCount'),
  ('balconyCount','베란다 개수','NUMBER',9,'balconyCount'),
  ('bathroomCount','화장실 개수','NUMBER',10,'bathroomCount'),
  ('kitchenCount','주방 개수','NUMBER',11,'kitchenCount'),
  ('specialNotes','특이사항','TEXTAREA',12,'specialNotes')
) AS f(field_key, label, input_type, sort_order, system_field)
WHERE t."is_default" = true
ON CONFLICT ("template_id","field_key") DO NOTHING;
