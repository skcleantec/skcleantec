-- 전자계약 — 동적 매핑 필드 정의 + 발급 시 관리자 치환값

CREATE TYPE "EContractFieldFilledBy" AS ENUM ('SIGNER', 'ADMIN', 'AUTO');
CREATE TYPE "EContractFieldInputType" AS ENUM ('TEXT', 'TEXTAREA', 'DATE', 'NUMBER', 'PHONE', 'RRN');

CREATE TABLE "e_contract_field_definitions" (
  "id" TEXT NOT NULL,
  "audience" "EContractAudience" NOT NULL,
  "token" VARCHAR(64) NOT NULL,
  "label" VARCHAR(128) NOT NULL,
  "input_type" "EContractFieldInputType" NOT NULL DEFAULT 'TEXT',
  "filled_by" "EContractFieldFilledBy" NOT NULL,
  "required" BOOLEAN NOT NULL DEFAULT true,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "e_contract_field_definitions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "e_contract_field_definitions_audience_token_key"
  ON "e_contract_field_definitions"("audience", "token");

CREATE INDEX "e_contract_field_definitions_audience_is_active_sort_order_idx"
  ON "e_contract_field_definitions"("audience", "is_active", "sort_order");

ALTER TABLE "e_contract_issuances" ADD COLUMN "merge_fields" JSONB;

-- 팀장용 기본 필드(기존 하드코드와 동일 토큰)
INSERT INTO "e_contract_field_definitions" ("id", "audience", "token", "label", "input_type", "filled_by", "required", "sort_order", "is_active", "updated_at") VALUES
  (gen_random_uuid()::text, 'TEAM_LEADER', '[[EC_SIGNER_NAME]]', '(을) 성함', 'TEXT', 'SIGNER', true, 10, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'TEAM_LEADER', '[[EC_SIGNER_RRN]]', '(을) 주민등록번호', 'RRN', 'SIGNER', true, 20, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'TEAM_LEADER', '[[EC_SIGNER_ADDRESS]]', '(을) 주소', 'TEXTAREA', 'SIGNER', true, 30, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'TEAM_LEADER', '[[EC_SIGNER_PHONE]]', '(을) 연락처', 'PHONE', 'SIGNER', true, 40, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'TEAM_LEADER', '[[EC_SIGNER_FREETEXT]]', '(을) 추가 기재(선택)', 'TEXTAREA', 'SIGNER', false, 50, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'TEAM_LEADER', '[[EC_SIGNATURE]]', '(을) 서명', 'TEXT', 'SIGNER', true, 60, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'TEAM_LEADER', '[[EC_CONTRACT_DATE]]', '계약일', 'DATE', 'AUTO', true, 100, true, CURRENT_TIMESTAMP);

-- 마케터용 기본 필드
INSERT INTO "e_contract_field_definitions" ("id", "audience", "token", "label", "input_type", "filled_by", "required", "sort_order", "is_active", "updated_at") VALUES
  (gen_random_uuid()::text, 'MARKETER', '[[EC_SIGNER_NAME]]', '성함', 'TEXT', 'SIGNER', true, 10, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'MARKETER', '[[EC_SIGNER_PHONE]]', '연락처', 'PHONE', 'SIGNER', true, 20, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'MARKETER', '[[EC_SIGNER_FREETEXT]]', '추가사항(선택)', 'TEXTAREA', 'SIGNER', false, 30, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'MARKETER', '[[EC_SIGNATURE]]', '서명', 'TEXT', 'SIGNER', true, 40, true, CURRENT_TIMESTAMP),
  (gen_random_uuid()::text, 'MARKETER', '[[EC_CONTRACT_DATE]]', '계약일', 'DATE', 'AUTO', true, 100, true, CURRENT_TIMESTAMP);
