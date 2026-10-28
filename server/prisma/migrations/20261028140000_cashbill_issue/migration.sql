-- CreateEnum
CREATE TYPE "CashBillIssueKind" AS ENUM ('DEPOSIT', 'BALANCE', 'FULL', 'CANCEL');

-- CreateTable
CREATE TABLE "cash_bill_issues" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "member_id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "mgt_key" VARCHAR(24) NOT NULL,
    "kind" "CashBillIssueKind" NOT NULL,
    "cancel_of_id" TEXT,
    "trade_usage" INTEGER NOT NULL,
    "identity_masked" VARCHAR(32) NOT NULL,
    "amount" INTEGER NOT NULL,
    "tax" INTEGER NOT NULL,
    "service_charge" INTEGER NOT NULL DEFAULT 0,
    "total_won" INTEGER NOT NULL,
    "trade_date" VARCHAR(8) NOT NULL,
    "barobill_state" VARCHAR(8),
    "nts_confirm_num" VARCHAR(32),
    "issued_at" TIMESTAMP(3),
    "charged_krw" INTEGER NOT NULL DEFAULT 0,
    "last_error" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_bill_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cashbill_platform_holds" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "code" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cashbill_platform_holds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cash_bill_issues_member_id_mgt_key_key" ON "cash_bill_issues"("member_id", "mgt_key");

-- CreateIndex
CREATE INDEX "cash_bill_issues_tenant_id_created_at_idx" ON "cash_bill_issues"("tenant_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "cash_bill_issues_tenant_id_inquiry_id_idx" ON "cash_bill_issues"("tenant_id", "inquiry_id");

-- CreateIndex
CREATE INDEX "cash_bill_issues_tenant_id_operating_company_id_created_at_idx" ON "cash_bill_issues"("tenant_id", "operating_company_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "cash_bill_issues_barobill_state_idx" ON "cash_bill_issues"("barobill_state");

-- CreateIndex
CREATE INDEX "cashbill_platform_holds_created_at_idx" ON "cashbill_platform_holds"("created_at" DESC);

-- AddForeignKey
ALTER TABLE "cash_bill_issues" ADD CONSTRAINT "cash_bill_issues_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_bill_issues" ADD CONSTRAINT "cash_bill_issues_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "barobill_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_bill_issues" ADD CONSTRAINT "cash_bill_issues_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_bill_issues" ADD CONSTRAINT "cash_bill_issues_operating_company_id_fkey" FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_bill_issues" ADD CONSTRAINT "cash_bill_issues_cancel_of_id_fkey" FOREIGN KEY ("cancel_of_id") REFERENCES "cash_bill_issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cashbill_platform_holds" ADD CONSTRAINT "cashbill_platform_holds_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
