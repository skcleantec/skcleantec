-- 현금영수증·세금계산서 추가 발행액. 접수 금액은 바꾸지 않고 발행 기록만 남긴다.
ALTER TABLE "cash_bill_issues" ADD COLUMN IF NOT EXISTS "extra_amount_won" INTEGER;
ALTER TABLE "cash_bill_issues" ADD COLUMN IF NOT EXISTS "extra_reason" VARCHAR(200);
ALTER TABLE "tax_invoice_issues" ADD COLUMN IF NOT EXISTS "extra_amount_won" INTEGER;
ALTER TABLE "tax_invoice_issues" ADD COLUMN IF NOT EXISTS "extra_reason" VARCHAR(200);
