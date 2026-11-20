-- 대응 카드 번호는 업체 안 브랜드마다 따로 둔다.
DROP INDEX IF EXISTS "telecrm_response_cards_tenant_id_code_key";

CREATE UNIQUE INDEX IF NOT EXISTS "telecrm_response_cards_tenant_id_operating_company_id_code_key"
  ON "telecrm_response_cards"("tenant_id", "operating_company_id", "code");
