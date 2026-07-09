-- 텔레CRM 숨고 — 부재·보류·고민 저장 시 자동 채팅 안내 (업체 공통)
ALTER TABLE "telecrm_soomgo_configs"
  ADD COLUMN "followup_absent_auto_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "followup_absent_message" TEXT,
  ADD COLUMN "followup_hold_auto_enabled" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "followup_hold_message" TEXT;
