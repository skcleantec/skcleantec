-- CreateTable
CREATE TABLE "inquiry_status_events" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "status" "InquiryStatus" NOT NULL,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,

    CONSTRAINT "inquiry_status_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inquiry_status_events_tenant_id_status_occurred_at_idx" ON "inquiry_status_events"("tenant_id", "status", "occurred_at");

-- CreateIndex
CREATE INDEX "inquiry_status_events_tenant_id_inquiry_id_occurred_at_idx" ON "inquiry_status_events"("tenant_id", "inquiry_id", "occurred_at");

-- CreateIndex
CREATE INDEX "inquiry_status_events_inquiry_id_idx" ON "inquiry_status_events"("inquiry_id");

-- AddForeignKey
ALTER TABLE "inquiry_status_events" ADD CONSTRAINT "inquiry_status_events_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_status_events" ADD CONSTRAINT "inquiry_status_events_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_status_events" ADD CONSTRAINT "inquiry_status_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
