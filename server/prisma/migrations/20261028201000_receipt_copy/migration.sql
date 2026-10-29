-- 현금영수증·세금계산서 확인용 사본 (이미지·PDF·공개 토큰)
-- 국세청 승인번호(세금계산서)는 상태 조회에 이미 있는 NTSSendKey 를 저장한다.

ALTER TABLE "cash_bill_issues" ADD COLUMN IF NOT EXISTS "copy_png_url" VARCHAR(2048);
ALTER TABLE "cash_bill_issues" ADD COLUMN IF NOT EXISTS "copy_pdf_url" VARCHAR(2048);
ALTER TABLE "cash_bill_issues" ADD COLUMN IF NOT EXISTS "public_token" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "cash_bill_issues_public_token_key" ON "cash_bill_issues"("public_token");

ALTER TABLE "tax_invoice_issues" ADD COLUMN IF NOT EXISTS "nts_send_key" VARCHAR(64);
ALTER TABLE "tax_invoice_issues" ADD COLUMN IF NOT EXISTS "copy_png_url" VARCHAR(2048);
ALTER TABLE "tax_invoice_issues" ADD COLUMN IF NOT EXISTS "copy_pdf_url" VARCHAR(2048);
ALTER TABLE "tax_invoice_issues" ADD COLUMN IF NOT EXISTS "public_token" VARCHAR(64);

CREATE UNIQUE INDEX IF NOT EXISTS "tax_invoice_issues_public_token_key" ON "tax_invoice_issues"("public_token");
