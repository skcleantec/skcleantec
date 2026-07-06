-- CreateIndex
CREATE INDEX "inquiries_tenant_id_preferred_date_idx" ON "inquiries"("tenant_id", "preferred_date");

-- CreateIndex
CREATE INDEX "inquiries_tenant_id_status_created_at_idx" ON "inquiries"("tenant_id", "status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "cs_reports_tenant_id_status_idx" ON "cs_reports"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "cs_reports_tenant_id_as_service_date_idx" ON "cs_reports"("tenant_id", "as_service_date");
