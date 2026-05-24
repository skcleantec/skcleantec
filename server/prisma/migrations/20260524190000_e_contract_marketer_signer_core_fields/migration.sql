-- 마케터 체결 필수 항목(주민번호·주소) 보강 및 정렬
INSERT INTO "e_contract_field_definitions" ("id", "audience", "token", "label", "input_type", "filled_by", "required", "sort_order", "is_active", "updated_at")
VALUES
  (gen_random_uuid()::text, 'MARKETER', '[[EC_SIGNER_RRN]]', '주민등록번호', 'RRN', 'SIGNER', true, 20, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'MARKETER', '[[EC_SIGNER_ADDRESS]]', '주소', 'TEXTAREA', 'SIGNER', true, 30, true, CURRENT_TIMESTAMP)
ON CONFLICT ("audience", "token") DO NOTHING;

UPDATE "e_contract_field_definitions"
SET "sort_order" = 40, "updated_at" = CURRENT_TIMESTAMP
WHERE "audience" = 'MARKETER' AND "token" = '[[EC_SIGNER_PHONE]]';

UPDATE "e_contract_field_definitions"
SET "sort_order" = 50, "updated_at" = CURRENT_TIMESTAMP
WHERE "audience" = 'MARKETER' AND "token" = '[[EC_SIGNER_FREETEXT]]';

UPDATE "e_contract_field_definitions"
SET "sort_order" = 60, "updated_at" = CURRENT_TIMESTAMP
WHERE "audience" = 'MARKETER' AND "token" = '[[EC_SIGNATURE]]';
