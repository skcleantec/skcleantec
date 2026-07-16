-- 에어컨 발주서: 입주청소 전용 항목 제거, 필수 항목만 유지

DELETE FROM "order_form_template_fields" f
USING "order_form_templates" tmpl
WHERE f."template_id" = tmpl."id"
  AND tmpl."is_default" = false
  AND tmpl."title" = '에어컨 청소 발주서'
  AND f."field_key" IN (
    'propertyType',
    'buildingType',
    'areaPyeong',
    'professionalOptions',
    'photos',
    'totalAmount'
  );

UPDATE "order_form_template_fields" f
SET "sort_order" = v.new_sort, "updated_at" = CURRENT_TIMESTAMP
FROM "order_form_templates" tmpl,
(VALUES
  ('customerName',0),
  ('customerPhone',1),
  ('customerEmail',2),
  ('address',3),
  ('preferredDate',4),
  ('preferredTime',5),
  ('ac_units',6),
  ('ac_detail_notes',7),
  ('specialNotes',8)
) AS v(field_key, new_sort)
WHERE f."template_id" = tmpl."id"
  AND tmpl."is_default" = false
  AND tmpl."title" = '에어컨 청소 발주서'
  AND f."field_key" = v.field_key;

UPDATE "order_form_templates"
SET "description" = '에어컨 청소 전용 발주서입니다. 연락처·주소·희망 일정과 청소할 기종·대수만 입력하면 됩니다. 브랜드·오염 상태 등은 상세란에 적어 주세요.',
    "updated_at" = CURRENT_TIMESTAMP
WHERE "is_default" = false
  AND "title" = '에어컨 청소 발주서';
