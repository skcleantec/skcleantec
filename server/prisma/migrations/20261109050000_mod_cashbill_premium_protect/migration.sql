-- Premium 기본으로 바뀌는 mod_cashbill: 이미 발행·바로빌 연결이 있는 업체는 메뉴가 사라지지 않게 켠다.
INSERT INTO "tenant_features" ("tenant_id", "module_id", "enabled", "meta")
SELECT DISTINCT src.tenant_id, 'mod_cashbill', true, '{}'::jsonb
FROM (
  SELECT "tenant_id" FROM "cash_bill_issues"
  UNION
  SELECT "tenant_id" FROM "tax_invoice_issues"
  UNION
  SELECT "tenant_id" FROM "barobill_members"
) AS src
ON CONFLICT ("tenant_id", "module_id")
DO UPDATE SET "enabled" = true;
