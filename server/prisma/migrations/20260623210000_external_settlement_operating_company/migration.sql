-- AlterTable: 타업체 정산 지급·리셋에 영업 브랜드 FK 추가
ALTER TABLE "external_company_settlement_payments" ADD COLUMN "operating_company_id" TEXT;
ALTER TABLE "external_company_settlement_resets" ADD COLUMN "operating_company_id" TEXT;

-- Backfill: 테넌트 default 브랜드 → 없으면 sort_order 최소 활성 브랜드
UPDATE "external_company_settlement_payments" p
SET "operating_company_id" = (
  SELECT oc.id
  FROM "external_companies" ec
  INNER JOIN "operating_companies" oc ON oc."tenant_id" = ec."tenant_id" AND oc."is_active" = true
  WHERE ec.id = p."external_company_id"
  ORDER BY oc."is_default" DESC, oc."sort_order" ASC, oc."created_at" ASC
  LIMIT 1
)
WHERE p."operating_company_id" IS NULL;

UPDATE "external_company_settlement_resets" r
SET "operating_company_id" = (
  SELECT oc.id
  FROM "external_companies" ec
  INNER JOIN "operating_companies" oc ON oc."tenant_id" = ec."tenant_id" AND oc."is_active" = true
  WHERE ec.id = r."external_company_id"
  ORDER BY oc."is_default" DESC, oc."sort_order" ASC, oc."created_at" ASC
  LIMIT 1
)
WHERE r."operating_company_id" IS NULL;

ALTER TABLE "external_company_settlement_payments" ALTER COLUMN "operating_company_id" SET NOT NULL;
ALTER TABLE "external_company_settlement_resets" ALTER COLUMN "operating_company_id" SET NOT NULL;

ALTER TABLE "external_company_settlement_payments"
  ADD CONSTRAINT "external_company_settlement_payments_operating_company_id_fkey"
  FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "external_company_settlement_resets"
  ADD CONSTRAINT "external_company_settlement_resets_operating_company_id_fkey"
  FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "external_company_settlement_payments_ext_oc_paid_idx"
  ON "external_company_settlement_payments"("external_company_id", "operating_company_id", "paid_at");

CREATE INDEX "external_company_settlement_resets_ext_oc_reset_idx"
  ON "external_company_settlement_resets"("external_company_id", "operating_company_id", "reset_at");
