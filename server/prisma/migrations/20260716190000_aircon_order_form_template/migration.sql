-- 플랫폼 공통 에어컨 청소 발주서 — 기존 테넌트 backfill (멱등)
-- 기종별 대수: 벽걸이·스탠드·천장형 1·2way·4way·2in1·원형·실외기

INSERT INTO "order_form_templates"
  ("id","tenant_id","title","icon","description","status","render_mode","version","is_default","sort_order","created_at","updated_at")
SELECT
  gen_random_uuid()::text,
  t."id",
  '에어컨 청소 발주서',
  '❄️',
  '에어컨 청소 전용 발주서입니다. 기종별 청소 대수를 입력받고, 브랜드·오염 상태 등은 상세란에 적어 주세요. (벽걸이·스탠드·천장형 1·2way·4way 등 업계 표준 분류)',
  'PUBLISHED',
  'TEMPLATE',
  1,
  false,
  1,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "tenants" t
WHERE NOT EXISTS (
  SELECT 1 FROM "order_form_templates" x
  WHERE x."tenant_id" = t."id"
    AND x."is_default" = false
    AND x."title" = '에어컨 청소 발주서'
);

INSERT INTO "order_form_template_fields"
  ("id","tenant_id","template_id","field_key","label","help_text","input_type","options","option_style","required","sort_order","system_field","fill_mode","show_in_inquiry_list","created_at","updated_at")
SELECT
  gen_random_uuid()::text,
  tmpl."tenant_id",
  tmpl."id",
  f.field_key,
  f.label,
  f.help_text,
  f.input_type::"OrderFormFieldInputType",
  f.options::jsonb,
  f.option_style,
  f.required,
  f.sort_order,
  f.system_field,
  f.fill_mode::"OrderFormFieldFillMode",
  f.show_in_inquiry_list,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "order_form_templates" tmpl
CROSS JOIN (VALUES
  ('customerName','고객명',NULL,'TEXT','[]',NULL,true,0,'customerName','CUSTOMER',false),
  ('customerPhone','전화번호',NULL,'PHONE','[]',NULL,true,1,'customerPhone','CUSTOMER',false),
  ('customerEmail','이메일',NULL,'TEXT','[]',NULL,true,2,'customerEmail','CUSTOMER',false),
  ('address','주소',NULL,'ADDRESS','[]',NULL,true,3,'address','CUSTOMER',false),
  ('propertyType','건물 유형',NULL,'SELECT','["아파트","오피스텔","빌라(연립)","상가","사무실","기타"]','DROPDOWN',true,4,'propertyType','CUSTOMER',false),
  ('buildingType','신축/구축',NULL,'SELECT','["신축","구축","인테리어","거주(짐이있는상태)"]','DROPDOWN',true,5,'buildingType','CUSTOMER',false),
  ('preferredDate','희망 작업일',NULL,'DATE','[]',NULL,true,6,'preferredDate','CUSTOMER',false),
  ('preferredTime','희망 시간대',NULL,'SELECT','["오전","오후","사이청소"]','DROPDOWN',true,7,'preferredTime','CUSTOMER',false),
  ('areaPyeong','평수(참고)','현장·견적 참고용입니다. 모르시면 0을 입력해 주세요.','NUMBER','[]',NULL,true,8,'areaPyeong','CUSTOMER',false),
  ('totalAmount','청소 비용(총액)','발주서 발급 시 담당자가 입력합니다.','MONEY','[]',NULL,true,9,'totalAmount','ADMIN_PREFILL',false),
  ('ac_wall_mount_count','벽걸이 (대)','가정용 벽걸이형(기본·와이드형 포함). 없으면 0','NUMBER','[]',NULL,false,10,NULL,'CUSTOMER',true),
  ('ac_stand_count','스탠드 (대)','스탠드형·무풍 스탠드 포함. 없으면 0','NUMBER','[]',NULL,false,11,NULL,'CUSTOMER',true),
  ('ac_system_1way_2way_count','천장형 1·2way (대)','바람 토출구 1~2개 천장형 시스템 에어컨','NUMBER','[]',NULL,false,12,NULL,'CUSTOMER',true),
  ('ac_system_4way_count','천장형 4way (대)','바람 토출구 4개 · 사무실·상가에서 흔함','NUMBER','[]',NULL,false,13,NULL,'CUSTOMER',false),
  ('ac_2in1_count','2in1 세트 (대)','벽걸이+스탠드 한 세트(투인원)','NUMBER','[]',NULL,false,14,NULL,'CUSTOMER',false),
  ('ac_round_360_count','원형(360°) 천장형 (대)','삼성 360 등 원형 천장형','NUMBER','[]',NULL,false,15,NULL,'CUSTOMER',false),
  ('ac_outdoor_unit_count','실외기 추가 청소 (대)','실내기와 별도로 실외기 청소를 원할 때','NUMBER','[]',NULL,false,16,NULL,'CUSTOMER',false),
  ('ac_detail_notes','에어컨 상세','브랜드·모델명(평형), 곰팡이·냄새, 층고·사다리 필요 여부, 완전분해 희망 등','TEXTAREA','[]',NULL,false,17,NULL,'CUSTOMER',false),
  ('specialNotes','기타 특이사항',NULL,'TEXTAREA','[]',NULL,false,18,'specialNotes','CUSTOMER',false)
) AS f(field_key, label, help_text, input_type, options, option_style, required, sort_order, system_field, fill_mode, show_in_inquiry_list)
WHERE tmpl."is_default" = false
  AND tmpl."title" = '에어컨 청소 발주서'
ON CONFLICT ("template_id","field_key") DO NOTHING;
