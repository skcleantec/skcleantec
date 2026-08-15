-- CreateTable
CREATE TABLE "telecrm_quote_crew_learning_snapshots" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "inquiry_number" VARCHAR(24),
    "customer_name" VARCHAR(120),
    "area_pyeong" DOUBLE PRECISION,
    "property_type" VARCHAR(64),
    "building_type" VARCHAR(64),
    "is_one_room" BOOLEAN NOT NULL DEFAULT false,
    "room_count" INTEGER,
    "bathroom_count" INTEGER,
    "balcony_count" INTEGER,
    "service_total_amount" INTEGER,
    "team_leader_count" INTEGER NOT NULL DEFAULT 0,
    "crew_member_count" INTEGER,
    "feature_key" VARCHAR(128) NOT NULL,
    "feature_label" VARCHAR(256) NOT NULL,
    "source_inquiry_updated_at" TIMESTAMP(3) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telecrm_quote_crew_learning_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telecrm_quote_crew_learning_snapshots_inquiry_id_key" ON "telecrm_quote_crew_learning_snapshots"("inquiry_id");

-- CreateIndex
CREATE INDEX "telecrm_quote_crew_learning_snapshots_tenant_id_updated_at_idx" ON "telecrm_quote_crew_learning_snapshots"("tenant_id", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "telecrm_quote_crew_learning_snapshots_tenant_id_feature_key_idx" ON "telecrm_quote_crew_learning_snapshots"("tenant_id", "feature_key");

-- CreateIndex
CREATE INDEX "telecrm_quote_crew_learning_snapshots_tenant_id_source_inquiry_idx" ON "telecrm_quote_crew_learning_snapshots"("tenant_id", "source_inquiry_updated_at" DESC);

-- AddForeignKey
ALTER TABLE "telecrm_quote_crew_learning_snapshots" ADD CONSTRAINT "telecrm_quote_crew_learning_snapshots_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "telecrm_quote_crew_learning_snapshots" ADD CONSTRAINT "telecrm_quote_crew_learning_snapshots_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
