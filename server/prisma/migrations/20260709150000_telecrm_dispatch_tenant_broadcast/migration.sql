-- ADMIN PC CRM → 업체 내 연결된 텔레CRM 앱 공통 수신
ALTER TABLE "telecrm_mobile_dispatch_pending"
ADD COLUMN "broadcast_to_tenant" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "telecrm_mobile_dispatch_pending_tenant_broadcast_idx"
ON "telecrm_mobile_dispatch_pending"("tenant_id", "broadcast_to_tenant", "created_at");
