-- 수정세금계산서 연결, 국세청 전송설정 코드, 인증서 만료 메일 1회 표시
ALTER TABLE "barobill_members" ADD COLUMN IF NOT EXISTS "cert_mail_d7_for_expire" VARCHAR(16);
ALTER TABLE "barobill_members" ADD COLUMN IF NOT EXISTS "cert_mail_day_for_expire" VARCHAR(16);
ALTER TABLE "barobill_members" ADD COLUMN IF NOT EXISTS "nts_taxation_option" INTEGER;
ALTER TABLE "barobill_members" ADD COLUMN IF NOT EXISTS "nts_tax_exemption_option" INTEGER;

ALTER TABLE "tax_invoice_issues" ADD COLUMN IF NOT EXISTS "modify_code" VARCHAR(2);
ALTER TABLE "tax_invoice_issues" ADD COLUMN IF NOT EXISTS "original_issue_id" TEXT;

CREATE INDEX IF NOT EXISTS "tax_invoice_issues_tenant_id_original_issue_id_idx"
  ON "tax_invoice_issues" ("tenant_id", "original_issue_id");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tax_invoice_issues_original_issue_id_fkey'
  ) THEN
    ALTER TABLE "tax_invoice_issues"
      ADD CONSTRAINT "tax_invoice_issues_original_issue_id_fkey"
      FOREIGN KEY ("original_issue_id") REFERENCES "tax_invoice_issues"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
