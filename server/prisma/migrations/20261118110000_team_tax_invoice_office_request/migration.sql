ALTER TABLE "tax_invoice_issues" ADD COLUMN IF NOT EXISTS "office_requested_at" TIMESTAMP(3);
ALTER TABLE "tax_invoice_issues" ADD COLUMN IF NOT EXISTS "office_requested_by_id" TEXT;
