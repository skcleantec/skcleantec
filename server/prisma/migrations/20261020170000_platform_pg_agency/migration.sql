-- 서비스브릿지 대리점. 판매자센터와 이용료 수기·인증 코드는 원성 화면에서 고친다.
CREATE TABLE IF NOT EXISTS "platform_pg_agencies" (
    "id" TEXT NOT NULL DEFAULT 'service-bridge',
    "business_name" VARCHAR(128) NOT NULL DEFAULT '서비스브릿지 (대리점)',
    "seller_center_login_id" VARCHAR(64),
    "seller_center_password_enc" TEXT,
    "keyin_mid" VARCHAR(32),
    "keyin_oid" VARCHAR(8),
    "keyin_tid_enc" TEXT,
    "keyin_api_key_enc" TEXT,
    "keyin_tid_masked" VARCHAR(32),
    "keyin_api_key_last4" VARCHAR(8),
    "link_mid" VARCHAR(32),
    "link_oid" VARCHAR(8),
    "link_tid_enc" TEXT,
    "link_api_key_enc" TEXT,
    "link_tid_masked" VARCHAR(32),
    "link_api_key_last4" VARCHAR(8),
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "platform_pg_agencies_pkey" PRIMARY KEY ("id")
);
