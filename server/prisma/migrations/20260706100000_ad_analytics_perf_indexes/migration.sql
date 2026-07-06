-- CreateIndex
CREATE INDEX "ad_work_sessions_tenant_id_ended_at_idx" ON "ad_work_sessions"("tenant_id", "ended_at");

-- CreateIndex
CREATE INDEX "order_forms_tenant_id_submitted_at_idx" ON "order_forms"("tenant_id", "submitted_at");
