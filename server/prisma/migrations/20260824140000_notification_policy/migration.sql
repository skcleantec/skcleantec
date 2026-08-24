-- TenantNotificationPolicy, UserNotificationPreference, NotificationDeliveryLog

CREATE TABLE "tenant_notification_policies" (
    "tenant_id" TEXT NOT NULL,
    "policy" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenant_notification_policies_pkey" PRIMARY KEY ("tenant_id")
);

CREATE TABLE "user_notification_preferences" (
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kinds" JSONB NOT NULL DEFAULT '{}',
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_notification_preferences_pkey" PRIMARY KEY ("tenant_id","user_id")
);

CREATE TABLE "notification_delivery_logs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" VARCHAR(32) NOT NULL,
    "dedupe_key" VARCHAR(160) NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_delivery_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "notification_delivery_logs_tenant_id_user_id_dedupe_key_key" ON "notification_delivery_logs"("tenant_id", "user_id", "dedupe_key");

CREATE INDEX "notification_delivery_logs_tenant_id_kind_sent_at_idx" ON "notification_delivery_logs"("tenant_id", "kind", "sent_at");

ALTER TABLE "tenant_notification_policies" ADD CONSTRAINT "tenant_notification_policies_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "user_notification_preferences" ADD CONSTRAINT "user_notification_preferences_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "notification_delivery_logs" ADD CONSTRAINT "notification_delivery_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
