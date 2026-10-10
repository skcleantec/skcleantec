-- 추가 시공 정산 종류. 환불은 못 받은 금액, 회사 지원은 회사가 보태는 금액.
DO $$
BEGIN
  CREATE TYPE "ExtraWorkSettlementKind" AS ENUM ('NORMAL', 'REFUND', 'COMPANY_SUPPORT');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "extra_work_records"
  ADD COLUMN IF NOT EXISTS "settlement_kind" "ExtraWorkSettlementKind" NOT NULL DEFAULT 'NORMAL';
