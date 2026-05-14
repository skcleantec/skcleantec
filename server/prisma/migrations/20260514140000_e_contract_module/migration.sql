-- 전자계약(팀장) 모듈 — `server/src/modules/e-contract`

CREATE TYPE "EContractVersionStatus" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "EContractIssuanceStatus" AS ENUM ('PENDING', 'OPENED', 'SIGNED', 'EXPIRED', 'REVOKED');

CREATE TABLE "e_contract_definitions" (
    "id" TEXT NOT NULL,
    "title" VARCHAR(512) NOT NULL,
    "description" TEXT,
    "is_archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "e_contract_definitions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "e_contract_versions" (
    "id" TEXT NOT NULL,
    "definition_id" TEXT NOT NULL,
    "status" "EContractVersionStatus" NOT NULL DEFAULT 'DRAFT',
    "published_ordinal" INTEGER,
    "title_snapshot" VARCHAR(512) NOT NULL,
    "body_markdown" TEXT NOT NULL,
    "content_hash" VARCHAR(128),
    "published_at" TIMESTAMP(3),
    "published_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "e_contract_versions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "e_contract_issuances" (
    "id" TEXT NOT NULL,
    "token" VARCHAR(128) NOT NULL,
    "definition_id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "team_leader_id" TEXT NOT NULL,
    "status" "EContractIssuanceStatus" NOT NULL DEFAULT 'PENDING',
    "expires_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "e_contract_issuances_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "e_contract_submissions" (
    "id" TEXT NOT NULL,
    "issuance_id" TEXT NOT NULL,
    "version_id" TEXT NOT NULL,
    "signed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "payload" JSONB,
    "version_content_hash" VARCHAR(128),
    "selfie_public_id" VARCHAR(512),
    "selfie_url" VARCHAR(2048),
    "signature_public_id" VARCHAR(512),
    "signature_url" VARCHAR(2048),
    "final_pdf_public_id" VARCHAR(512),
    "final_pdf_url" VARCHAR(2048),
    "signer_user_agent" VARCHAR(512),
    "signer_ip" VARCHAR(64),

    CONSTRAINT "e_contract_submissions_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "e_contract_versions_definition_id_published_ordinal_key"
  ON "e_contract_versions" ("definition_id", "published_ordinal");

CREATE INDEX "e_contract_definitions_is_archived_updated_at_idx"
  ON "e_contract_definitions" ("is_archived", "updated_at" DESC);

CREATE INDEX "e_contract_versions_definition_id_status_idx"
  ON "e_contract_versions" ("definition_id", "status");

CREATE UNIQUE INDEX "e_contract_issuances_token_key"
  ON "e_contract_issuances" ("token");

CREATE INDEX "e_contract_issuances_team_leader_id_created_at_idx"
  ON "e_contract_issuances" ("team_leader_id", "created_at" DESC);

CREATE INDEX "e_contract_issuances_definition_id_version_id_idx"
  ON "e_contract_issuances" ("definition_id", "version_id");

CREATE UNIQUE INDEX "e_contract_submissions_issuance_id_key"
  ON "e_contract_submissions" ("issuance_id");

CREATE INDEX "e_contract_submissions_version_id_signed_at_idx"
  ON "e_contract_submissions" ("version_id", "signed_at" DESC);

ALTER TABLE "e_contract_definitions"
  ADD CONSTRAINT "e_contract_definitions_created_by_id_fkey"
  FOREIGN KEY ("created_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "e_contract_versions"
  ADD CONSTRAINT "e_contract_versions_definition_id_fkey"
  FOREIGN KEY ("definition_id") REFERENCES "e_contract_definitions" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "e_contract_versions"
  ADD CONSTRAINT "e_contract_versions_published_by_id_fkey"
  FOREIGN KEY ("published_by_id") REFERENCES "users" ("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "e_contract_issuances"
  ADD CONSTRAINT "e_contract_issuances_definition_id_fkey"
  FOREIGN KEY ("definition_id") REFERENCES "e_contract_definitions" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "e_contract_issuances"
  ADD CONSTRAINT "e_contract_issuances_version_id_fkey"
  FOREIGN KEY ("version_id") REFERENCES "e_contract_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "e_contract_issuances"
  ADD CONSTRAINT "e_contract_issuances_team_leader_id_fkey"
  FOREIGN KEY ("team_leader_id") REFERENCES "users" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "e_contract_submissions"
  ADD CONSTRAINT "e_contract_submissions_issuance_id_fkey"
  FOREIGN KEY ("issuance_id") REFERENCES "e_contract_issuances" ("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "e_contract_submissions"
  ADD CONSTRAINT "e_contract_submissions_version_id_fkey"
  FOREIGN KEY ("version_id") REFERENCES "e_contract_versions" ("id") ON DELETE RESTRICT ON UPDATE CASCADE;
