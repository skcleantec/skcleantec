-- 이용료 면제 업체·면제 범위
ALTER TABLE "tenant_billing_profiles" ADD COLUMN IF NOT EXISTS "fee_exempt" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "tenant_billing_profiles" ADD COLUMN IF NOT EXISTS "fee_exempt_addons" BOOLEAN NOT NULL DEFAULT false;

-- 기존 「약정 0원」 면제 업체를 면제 업체로 옮긴다.
-- 지금까지는 면제 업체의 열린 청구서를 모두 무효 처리했으므로 부가 요금까지 면제로 옮겨 동작을 유지한다.
UPDATE "tenant_billing_profiles"
SET "fee_exempt" = true, "fee_exempt_addons" = true
WHERE "pricing_mode" = 'CUSTOM'
  AND (
    ("billing_cycle" = 'MONTHLY' AND "custom_monthly_amount_krw" = 0)
    OR ("billing_cycle" = 'ANNUAL' AND ("custom_annual_amount_krw" = 0 OR ("custom_annual_amount_krw" IS NULL AND "custom_monthly_amount_krw" = 0)))
  );
