-- 현금영수증 과세구분. 기존 건은 과세(taxable).
ALTER TABLE "cash_bill_issues" ADD COLUMN IF NOT EXISTS "tax_kind" VARCHAR(16) NOT NULL DEFAULT 'taxable';
