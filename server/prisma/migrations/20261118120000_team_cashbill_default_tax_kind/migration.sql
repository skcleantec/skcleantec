-- 팀장 현금영수증 기본 과세구분. 기본은 과세.

ALTER TABLE "tenants"
  ADD COLUMN "team_cashbill_default_tax_kind" VARCHAR(16) NOT NULL DEFAULT 'taxable';
