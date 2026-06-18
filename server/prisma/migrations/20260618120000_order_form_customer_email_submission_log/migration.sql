-- CreateEnum
CREATE TYPE "OrderFormSubmissionEmailStatus" AS ENUM ('SENT', 'FAILED', 'SKIPPED_NO_SMTP');

-- AlterTable
ALTER TABLE "inquiries" ADD COLUMN "customer_email" VARCHAR(320);

-- AlterTable
ALTER TABLE "order_forms" ADD COLUMN "customer_email" VARCHAR(320);

-- CreateTable
CREATE TABLE "order_form_submission_email_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "order_form_id" TEXT NOT NULL,
    "operating_company_id" TEXT,
    "to_email" VARCHAR(320) NOT NULL,
    "status" "OrderFormSubmissionEmailStatus" NOT NULL,
    "attempt_count" INTEGER NOT NULL DEFAULT 1,
    "last_error" TEXT,
    "sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_form_submission_email_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "order_form_submission_email_logs_order_form_id_key" ON "order_form_submission_email_logs"("order_form_id");

-- CreateIndex
CREATE INDEX "order_form_submission_email_logs_tenant_id_status_idx" ON "order_form_submission_email_logs"("tenant_id", "status");

-- AddForeignKey
ALTER TABLE "order_form_submission_email_logs" ADD CONSTRAINT "order_form_submission_email_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_form_submission_email_logs" ADD CONSTRAINT "order_form_submission_email_logs_order_form_id_fkey" FOREIGN KEY ("order_form_id") REFERENCES "order_forms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 기본 발주서 템플릿에 이메일 표준 항목 추가
INSERT INTO "order_form_template_fields"
  ("id","tenant_id","template_id","field_key","label","help_text","input_type","options","required","sort_order","system_field","fill_mode","created_at","updated_at")
SELECT
  gen_random_uuid()::text,
  t."tenant_id",
  t."id",
  f.field_key,
  f.label,
  NULL,
  f.input_type::"OrderFormFieldInputType",
  f.options::jsonb,
  true,
  f.sort_order,
  f.system_field,
  'CUSTOMER'::"OrderFormFieldFillMode",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "order_form_templates" t
CROSS JOIN (VALUES
  ('customerEmail','이메일','TEXT','[]',13,'customerEmail')
) AS f(field_key, label, input_type, options, sort_order, system_field)
WHERE t."is_default" = true
ON CONFLICT ("template_id","field_key") DO NOTHING;
