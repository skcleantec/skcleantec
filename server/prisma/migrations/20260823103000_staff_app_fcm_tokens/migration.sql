-- Google Play 「청소비서」 업무 앱 FCM 토큰 (com.cbiseo.app)

CREATE TABLE "staff_app_fcm_tokens" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "app_id" VARCHAR(64) NOT NULL DEFAULT 'com.cbiseo.app',
    "device_label" VARCHAR(128),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "staff_app_fcm_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "staff_app_fcm_tokens_token_key" ON "staff_app_fcm_tokens"("token");

CREATE INDEX "staff_app_fcm_tokens_tenant_id_user_id_idx" ON "staff_app_fcm_tokens"("tenant_id", "user_id");

ALTER TABLE "staff_app_fcm_tokens" ADD CONSTRAINT "staff_app_fcm_tokens_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "staff_app_fcm_tokens" ADD CONSTRAINT "staff_app_fcm_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
