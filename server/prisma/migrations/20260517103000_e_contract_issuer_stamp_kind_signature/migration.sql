-- 갑(인) 표시: 도장(SEAL) 또는 서명 이미지(SIGNATURE)

CREATE TYPE "EContractIssuerStampKind" AS ENUM ('SEAL', 'SIGNATURE');

ALTER TABLE "e_contract_issuer_profiles"
ADD COLUMN "issuer_stamp_kind" "EContractIssuerStampKind" NOT NULL DEFAULT 'SEAL',
ADD COLUMN "signature_public_id" VARCHAR(512),
ADD COLUMN "signature_secure_url" VARCHAR(2048),
ADD COLUMN "signature_display_width_px" INTEGER;
