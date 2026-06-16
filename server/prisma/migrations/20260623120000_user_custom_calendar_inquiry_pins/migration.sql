-- 사용자 맞춤 캘린더 · 접수 수동 포함
CREATE TABLE "user_custom_calendar_inquiry_pins" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "calendar_id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_custom_calendar_inquiry_pins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_custom_calendar_inquiry_pins_calendar_id_inquiry_id_key" ON "user_custom_calendar_inquiry_pins"("calendar_id", "inquiry_id");

CREATE INDEX "user_custom_calendar_inquiry_pins_tenant_id_user_id_calendar_id_idx" ON "user_custom_calendar_inquiry_pins"("tenant_id", "user_id", "calendar_id");

CREATE INDEX "user_custom_calendar_inquiry_pins_tenant_id_inquiry_id_idx" ON "user_custom_calendar_inquiry_pins"("tenant_id", "inquiry_id");

ALTER TABLE "user_custom_calendar_inquiry_pins" ADD CONSTRAINT "user_custom_calendar_inquiry_pins_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_custom_calendar_inquiry_pins" ADD CONSTRAINT "user_custom_calendar_inquiry_pins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_custom_calendar_inquiry_pins" ADD CONSTRAINT "user_custom_calendar_inquiry_pins_calendar_id_fkey" FOREIGN KEY ("calendar_id") REFERENCES "user_custom_calendars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_custom_calendar_inquiry_pins" ADD CONSTRAINT "user_custom_calendar_inquiry_pins_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
