-- 에어컨 청소 발주서 — 상단 견적·페이백·전문시공·사진 섹션을 기본 발주서와 동일하게 보강 (멱등)

INSERT INTO "order_form_template_fields"
  ("id","tenant_id","template_id","field_key","label","help_text","input_type","options","option_style","required","sort_order","system_field","fill_mode","show_in_inquiry_list","created_at","updated_at")
SELECT
  gen_random_uuid()::text,
  tmpl."tenant_id",
  tmpl."id",
  f.field_key,
  f.label,
  NULL,
  f.input_type::"OrderFormFieldInputType",
  '[]'::jsonb,
  NULL,
  false,
  f.sort_order,
  f.system_field,
  'CUSTOMER'::"OrderFormFieldFillMode",
  false,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "order_form_templates" tmpl
CROSS JOIN (VALUES
  ('professionalOptions','전문 시공 옵션(섹션)','TEXT',9,'professionalOptions'),
  ('photos','현장 사진 첨부(섹션)','TEXT',10,'photos')
) AS f(field_key, label, input_type, sort_order, system_field)
WHERE tmpl."is_default" = false
  AND tmpl."title" = '에어컨 청소 발주서'
ON CONFLICT ("template_id","field_key") DO NOTHING;

-- 총액은 발급 금액·상단 견적 카드로만 표시 (폼 본문 중복 필드 제거)
DELETE FROM "order_form_template_fields" f
USING "order_form_templates" tmpl
WHERE f."template_id" = tmpl."id"
  AND tmpl."is_default" = false
  AND tmpl."title" = '에어컨 청소 발주서'
  AND f."field_key" = 'totalAmount';

-- 기종별 대수 필드 sort_order 정렬 (섹션 토글 9~10 이후)
UPDATE "order_form_template_fields" f
SET "sort_order" = v.new_sort, "updated_at" = CURRENT_TIMESTAMP
FROM "order_form_templates" tmpl,
(VALUES
  ('ac_wall_mount_count',11),
  ('ac_stand_count',12),
  ('ac_system_1way_2way_count',13),
  ('ac_system_4way_count',14),
  ('ac_2in1_count',15),
  ('ac_round_360_count',16),
  ('ac_outdoor_unit_count',17),
  ('ac_detail_notes',18),
  ('specialNotes',19)
) AS v(field_key, new_sort)
WHERE f."template_id" = tmpl."id"
  AND tmpl."is_default" = false
  AND tmpl."title" = '에어컨 청소 발주서'
  AND f."field_key" = v.field_key;
