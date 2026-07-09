-- PC CRM → 텔레CRM Android dispatch 대기열 (멀티 인스턴스·WS 폴백)
CREATE TABLE "telecrm_mobile_dispatch_pending" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "action" VARCHAR(16) NOT NULL,
    "phone" VARCHAR(32) NOT NULL,
    "body" TEXT,
    "image_url" VARCHAR(512),
    "inquiry_id" TEXT,
    "customer_match" VARCHAR(16),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "telecrm_mobile_dispatch_pending_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "telecrm_mobile_dispatch_pending_tenant_id_user_id_created_at_idx"
ON "telecrm_mobile_dispatch_pending"("tenant_id", "user_id", "created_at");

ALTER TABLE "telecrm_mobile_dispatch_pending"
ADD CONSTRAINT "telecrm_mobile_dispatch_pending_tenant_id_fkey"
FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "telecrm_mobile_dispatch_pending"
ADD CONSTRAINT "telecrm_mobile_dispatch_pending_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
