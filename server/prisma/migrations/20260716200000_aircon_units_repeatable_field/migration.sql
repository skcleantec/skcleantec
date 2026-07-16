-- 에어컨 발주서: 기종별 개별 대수 필드 → ac_units(추가하기) 통합, 총액 본문 필드 제거

DELETE FROM "order_form_template_fields" f
USING "order_form_templates" tmpl
WHERE f."template_id" = tmpl."id"
  AND tmpl."is_default" = false
  AND tmpl."title" = '에어컨 청소 발주서'
  AND f."field_key" IN (
    'totalAmount',
    'ac_wall_mount_count',
    'ac_stand_count',
    'ac_system_1way_2way_count',
    'ac_system_4way_count',
    'ac_2in1_count',
    'ac_round_360_count',
    'ac_outdoor_unit_count'
  );

INSERT INTO "order_form_template_fields"
  ("id","tenant_id","template_id","field_key","label","help_text","input_type","options","option_style","required","sort_order","system_field","fill_mode","show_in_inquiry_list","created_at","updated_at")
SELECT
  gen_random_uuid()::text,
  tmpl."tenant_id",
  tmpl."id",
  'ac_units',
  '청소할 에어컨',
  '기종을 선택하고 대수를 입력한 뒤 「추가하기」를 눌러 주세요. 여러 기종이면 반복해서 추가합니다.',
  'SELECT'::"OrderFormFieldInputType",
  '["벽걸이","스탠드","천장형 1·2way","천장형 4way","2in1 세트","원형(360°) 천장형","실외기 추가"]'::jsonb,
  'DROPDOWN',
  true,
  11,
  NULL,
  'CUSTOMER'::"OrderFormFieldFillMode",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "order_form_templates" tmpl
WHERE tmpl."is_default" = false
  AND tmpl."title" = '에어컨 청소 발주서'
ON CONFLICT ("template_id","field_key") DO UPDATE SET
  "label" = EXCLUDED."label",
  "help_text" = EXCLUDED."help_text",
  "input_type" = EXCLUDED."input_type",
  "options" = EXCLUDED."options",
  "option_style" = EXCLUDED."option_style",
  "required" = EXCLUDED."required",
  "sort_order" = EXCLUDED."sort_order",
  "show_in_inquiry_list" = EXCLUDED."show_in_inquiry_list",
  "updated_at" = CURRENT_TIMESTAMP;

UPDATE "order_form_template_fields" f
SET "sort_order" = v.new_sort, "updated_at" = CURRENT_TIMESTAMP
FROM "order_form_templates" tmpl,
(VALUES
  ('ac_detail_notes',12),
  ('specialNotes',13)
) AS v(field_key, new_sort)
WHERE f."template_id" = tmpl."id"
  AND tmpl."is_default" = false
  AND tmpl."title" = '에어컨 청소 발주서'
  AND f."field_key" = v.field_key;

UPDATE "order_form_templates"
SET "description" = '에어컨 청소 전용 발주서입니다. 기종을 선택하고 대수를 입력한 뒤 추가하기로 등록해 주세요. 브랜드·오염 상태 등은 상세란에 적어 주세요.',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "is_default" = false
  AND "title" = '에어컨 청소 발주서';
