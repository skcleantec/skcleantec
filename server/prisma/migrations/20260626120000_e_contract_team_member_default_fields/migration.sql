-- 팀원(TEAM_MEMBER) 전자계약 — 체결 입력 필드 기본값 (팀장과 동일 을-party)
-- multitenant: tenant_id 별 idempotent 삽입

INSERT INTO "e_contract_field_definitions" (
  "id", "tenant_id", "audience", "token", "label", "input_type", "filled_by", "required", "sort_order", "is_active", "updated_at"
)
SELECT
  gen_random_uuid()::text,
  t."id",
  'TEAM_MEMBER'::"EContractAudience",
  v."token",
  v."label",
  v."input_type"::"EContractFieldInputType",
  v."filled_by"::"EContractFieldFilledBy",
  v."required",
  v."sort_order",
  true,
  CURRENT_TIMESTAMP
FROM "tenants" t
CROSS JOIN (
  VALUES
    ('[[EC_SIGNER_NAME]]', '(을) 성함', 'TEXT', 'SIGNER', true, 10),
    ('[[EC_SIGNER_RRN]]', '(을) 주민등록번호', 'RRN', 'SIGNER', true, 20),
    ('[[EC_SIGNER_ADDRESS]]', '(을) 주소', 'TEXTAREA', 'SIGNER', true, 30),
    ('[[EC_SIGNER_PHONE]]', '(을) 연락처', 'PHONE', 'SIGNER', true, 40),
    ('[[EC_SIGNER_FREETEXT]]', '(을) 추가 기재(선택)', 'TEXTAREA', 'SIGNER', false, 50),
    ('[[EC_SIGNATURE]]', '(을) 서명', 'TEXT', 'SIGNER', true, 60),
    ('[[EC_CONTRACT_DATE]]', '계약일', 'DATE', 'AUTO', true, 100)
) AS v("token", "label", "input_type", "filled_by", "required", "sort_order")
WHERE NOT EXISTS (
  SELECT 1
  FROM "e_contract_field_definitions" d
  WHERE d."tenant_id" = t."id"
    AND d."audience" = 'TEAM_MEMBER'::"EContractAudience"
    AND d."token" = v."token"
);
