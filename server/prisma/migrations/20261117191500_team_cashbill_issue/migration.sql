-- 팀장 현금영수증: 업체·팀장 허용(기본 켜짐), 취소 요청 시각

ALTER TABLE "tenants"
  ADD COLUMN "team_cashbill_issue_enabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "users"
  ADD COLUMN "cashbill_issue_enabled" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "cash_bill_issues"
  ADD COLUMN "cancel_requested_at" TIMESTAMP(3),
  ADD COLUMN "cancel_requested_by_id" TEXT;
