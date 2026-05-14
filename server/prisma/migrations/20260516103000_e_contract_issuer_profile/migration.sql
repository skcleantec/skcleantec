-- 전자계약 발행측(갑) 프로필 및 배포 버전 치환 스냅샷 컬럼

CREATE TABLE "e_contract_issuer_profiles" (
    "id" TEXT NOT NULL,
    "profile_key" VARCHAR(64) NOT NULL DEFAULT 'default',
    "company_name" VARCHAR(512) NOT NULL DEFAULT '',
    "representative_name" VARCHAR(128),
    "business_registration_no" VARCHAR(32),
    "address_line" TEXT,
    "phone" VARCHAR(64),
    "fax" VARCHAR(64),
    "email" VARCHAR(256),
    "seal_public_id" VARCHAR(512),
    "seal_secure_url" VARCHAR(2048),
    "seal_display_width_px" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by_id" TEXT,

    CONSTRAINT "e_contract_issuer_profiles_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "e_contract_issuer_profiles_profile_key_key" ON "e_contract_issuer_profiles"("profile_key");

ALTER TABLE "e_contract_issuer_profiles" ADD CONSTRAINT "e_contract_issuer_profiles_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "e_contract_versions" ADD COLUMN "issuer_snapshot" JSONB,
ADD COLUMN "body_display_html" TEXT;
