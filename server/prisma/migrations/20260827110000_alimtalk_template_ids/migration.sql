-- 솔라피 검수 승인 templateId (env 미설정 시 DB 폴백)
INSERT INTO "alimtalk_templates" ("id", "code", "solapi_template_id", "name", "trigger_type", "is_active", "created_at", "updated_at")
VALUES
  (gen_random_uuid(), 'CBISEO_CUST_ORDER_LINK', 'KA01TP260821085834166DanPJHVm7HA', '[고객] 발주서 작성·예약 안내', 'manual', true, NOW(), NOW()),
  (gen_random_uuid(), 'CBISEO_CUST_ORDER_DONE', 'KA01TP2608210907017889JVtrqGLFhq', '[고객] 예약(발주서) 접수 완료', 'auto', true, NOW(), NOW()),
  (gen_random_uuid(), 'CBISEO_CUST_SCHEDULE_D2', 'KA01TP260821092336472avWT4PJf0Dn', '[고객] 예약 일정 확인(청소 2일 전)', 'auto', true, NOW(), NOW())
ON CONFLICT ("code") DO UPDATE SET
  "solapi_template_id" = EXCLUDED."solapi_template_id",
  "name" = EXCLUDED."name",
  "trigger_type" = EXCLUDED."trigger_type",
  "is_active" = EXCLUDED."is_active",
  "updated_at" = NOW();
