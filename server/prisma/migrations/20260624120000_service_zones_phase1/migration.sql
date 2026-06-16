-- ServiceZone · UserServiceZone · UserCustomCalendar.service_zone_id

CREATE TABLE "service_zones" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(64) NOT NULL,
    "regions" JSONB NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_zones_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "user_service_zones" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "service_zone_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_service_zones_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "user_custom_calendars" ADD COLUMN "service_zone_id" TEXT;

CREATE INDEX "service_zones_tenant_id_sort_order_idx" ON "service_zones"("tenant_id", "sort_order");
CREATE INDEX "service_zones_tenant_id_is_active_idx" ON "service_zones"("tenant_id", "is_active");
CREATE UNIQUE INDEX "user_service_zones_user_id_service_zone_id_key" ON "user_service_zones"("user_id", "service_zone_id");
CREATE INDEX "user_service_zones_tenant_id_service_zone_id_idx" ON "user_service_zones"("tenant_id", "service_zone_id");
CREATE INDEX "user_service_zones_tenant_id_user_id_idx" ON "user_service_zones"("tenant_id", "user_id");
CREATE INDEX "user_custom_calendars_tenant_id_service_zone_id_idx" ON "user_custom_calendars"("tenant_id", "service_zone_id");

ALTER TABLE "service_zones" ADD CONSTRAINT "service_zones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_service_zones" ADD CONSTRAINT "user_service_zones_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_service_zones" ADD CONSTRAINT "user_service_zones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_service_zones" ADD CONSTRAINT "user_service_zones_service_zone_id_fkey" FOREIGN KEY ("service_zone_id") REFERENCES "service_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "user_custom_calendars" ADD CONSTRAINT "user_custom_calendars_service_zone_id_fkey" FOREIGN KEY ("service_zone_id") REFERENCES "service_zones"("id") ON DELETE SET NULL ON UPDATE CASCADE;
