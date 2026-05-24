-- 전자계약 — 마케터 수신 대상(링크 발급) 구분

CREATE TYPE "EContractAudience" AS ENUM ('TEAM_LEADER', 'MARKETER');

ALTER TABLE "e_contract_definitions"
  ADD COLUMN "audience" "EContractAudience" NOT NULL DEFAULT 'TEAM_LEADER';

CREATE INDEX "e_contract_definitions_audience_updated_at_idx"
  ON "e_contract_definitions" ("audience", "updated_at" DESC);
