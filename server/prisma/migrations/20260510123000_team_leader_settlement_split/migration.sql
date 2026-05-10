-- 팀장 일반·추가결재 분리(Phase 1): 사용자 필드, 지급 버킷, 접수별 추가결재 테이블

CREATE TYPE "TeamLeaderGeneralSettlementMode" AS ENUM ('FIXED_PER_JOB_WON', 'PERCENT_OF_GENERAL_SERVICE_BPS');

CREATE TYPE "TeamLeaderPayrollPaymentBucket" AS ENUM ('GENERAL_JOB_SETTLEMENT', 'ADDITIONAL_RECEIPT_SETTLEMENT');

ALTER TABLE "users" ADD COLUMN "team_leader_general_settlement_mode" "TeamLeaderGeneralSettlementMode",
ADD COLUMN "team_leader_general_settlement_value" INTEGER,
ADD COLUMN "team_leader_additional_receipt_company_share_bps" INTEGER;

ALTER TABLE "team_leader_payroll_payments" ADD COLUMN "settlement_bucket" "TeamLeaderPayrollPaymentBucket" NOT NULL DEFAULT 'GENERAL_JOB_SETTLEMENT';

CREATE TABLE "inquiry_additional_receipts" (
    "id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "description" VARCHAR(120) NOT NULL,
    "amount" INTEGER NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiry_additional_receipts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "inquiry_additional_receipts_inquiry_id_sort_order_idx" ON "inquiry_additional_receipts"("inquiry_id", "sort_order");

ALTER TABLE "inquiry_additional_receipts" ADD CONSTRAINT "inquiry_additional_receipts_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "inquiry_additional_receipts" ADD CONSTRAINT "inquiry_additional_receipts_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
