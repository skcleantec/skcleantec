-- CreateEnum
CREATE TYPE "PlatformWalletInvoiceStatus" AS ENUM ('PENDING', 'ISSUED', 'FAILED', 'SKIPPED');

-- AlterTable: UsageFeeCardPayment has no DDL change; relation is handled by Prisma only.

-- CreateTable: platform_wallet_invoices
CREATE TABLE "platform_wallet_invoices" (
    "id"            TEXT NOT NULL,
    "payment_id"    TEXT NOT NULL,
    "tenant_id"     TEXT NOT NULL,
    "status"        "PlatformWalletInvoiceStatus" NOT NULL DEFAULT 'PENDING',
    "mgt_key"       VARCHAR(100),
    "nts_send_key"  VARCHAR(100),
    "cost_krw"      INTEGER NOT NULL DEFAULT 0,
    "error"         VARCHAR(500),
    "issued_at"     TIMESTAMP(3),
    "cancelled_at"  TIMESTAMP(3),
    "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_wallet_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable: platform_cash_bill_issues
CREATE TABLE "platform_cash_bill_issues" (
    "id"                          TEXT NOT NULL,
    "mgt_key"                     VARCHAR(100) NOT NULL,
    "trade_usage"                 VARCHAR(2) NOT NULL,
    "identity_masked"             VARCHAR(40) NOT NULL,
    "customer_name"               VARCHAR(80),
    "item_name"                   VARCHAR(100) NOT NULL,
    "tax_kind"                    VARCHAR(10) NOT NULL,
    "amount"                      INTEGER NOT NULL,
    "tax"                         INTEGER NOT NULL,
    "service_charge"              INTEGER NOT NULL,
    "total_won"                   INTEGER NOT NULL,
    "trade_date"                  VARCHAR(8) NOT NULL,
    "barobill_state"              VARCHAR(20),
    "nts_confirm_num"             VARCHAR(40),
    "issued_at"                   TIMESTAMP(3),
    "cost_krw"                    INTEGER NOT NULL DEFAULT 0,
    "last_error"                  VARCHAR(500),
    "internal_memo"               VARCHAR(300),
    "buyer_tenant_id"             TEXT,
    "buyer_corp_num"              VARCHAR(20),
    "created_by_platform_user_id" TEXT,
    "cancel_of_id"                TEXT,
    "kind"                        VARCHAR(10) NOT NULL DEFAULT 'FULL',
    "created_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_cash_bill_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable: platform_tax_invoice_issues
CREATE TABLE "platform_tax_invoice_issues" (
    "id"                          TEXT NOT NULL,
    "mgt_key"                     VARCHAR(100) NOT NULL,
    "purpose_type"                INTEGER NOT NULL,
    "write_date"                  VARCHAR(8) NOT NULL,
    "buyer_corp_num"              VARCHAR(20) NOT NULL,
    "buyer_corp_name"             VARCHAR(100) NOT NULL,
    "buyer_ceo_name"              VARCHAR(80) NOT NULL DEFAULT '',
    "buyer_addr"                  VARCHAR(200) NOT NULL DEFAULT '',
    "buyer_email"                 VARCHAR(200) NOT NULL DEFAULT '',
    "buyer_contact_name"          VARCHAR(80) NOT NULL DEFAULT '',
    "supply_krw"                  INTEGER NOT NULL,
    "tax_krw"                     INTEGER NOT NULL,
    "total_krw"                   INTEGER NOT NULL,
    "lines"                       JSONB NOT NULL DEFAULT '[]',
    "barobill_state"              VARCHAR(20),
    "nts_send_state"              VARCHAR(10),
    "nts_send_key"                VARCHAR(100),
    "cost_krw"                    INTEGER NOT NULL DEFAULT 0,
    "last_error"                  VARCHAR(500),
    "internal_memo"               VARCHAR(300),
    "buyer_tenant_id"             TEXT,
    "modify_code"                 VARCHAR(4),
    "original_issue_id"           TEXT,
    "created_by_platform_user_id" TEXT,
    "created_at"                  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at"                  TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_tax_invoice_issues_pkey" PRIMARY KEY ("id")
);

-- CreateUnique
CREATE UNIQUE INDEX "platform_wallet_invoices_payment_id_key" ON "platform_wallet_invoices"("payment_id");
CREATE UNIQUE INDEX "platform_cash_bill_issues_mgt_key_key" ON "platform_cash_bill_issues"("mgt_key");
CREATE UNIQUE INDEX "platform_tax_invoice_issues_mgt_key_key" ON "platform_tax_invoice_issues"("mgt_key");

-- CreateIndex
CREATE INDEX "platform_wallet_invoices_tenant_id_created_at_idx" ON "platform_wallet_invoices"("tenant_id", "created_at" DESC);
CREATE INDEX "platform_wallet_invoices_status_created_at_idx" ON "platform_wallet_invoices"("status", "created_at" DESC);
CREATE INDEX "platform_cash_bill_issues_created_at_idx" ON "platform_cash_bill_issues"("created_at" DESC);
CREATE INDEX "platform_cash_bill_issues_buyer_tenant_id_created_at_idx" ON "platform_cash_bill_issues"("buyer_tenant_id", "created_at" DESC);
CREATE INDEX "platform_tax_invoice_issues_created_at_idx" ON "platform_tax_invoice_issues"("created_at" DESC);
CREATE INDEX "platform_tax_invoice_issues_buyer_tenant_id_created_at_idx" ON "platform_tax_invoice_issues"("buyer_tenant_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "platform_wallet_invoices" ADD CONSTRAINT "platform_wallet_invoices_payment_id_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "usage_fee_card_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
