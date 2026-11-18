-- 브랜드 카카오 채널 승인·연결·반려 알림을 한 번만 보내고, 마지막 확인 시각을 남긴다.
ALTER TABLE "platform_billing_settings" ADD COLUMN "alimtalk_brand_channel_last_checked_at" TIMESTAMP(3);
ALTER TABLE "alimtalk_brand_channels" ADD COLUMN "linked_notified_at" TIMESTAMP(3);
ALTER TABLE "alimtalk_brand_templates" ADD COLUMN "approved_notified_at" TIMESTAMP(3);
ALTER TABLE "alimtalk_brand_templates" ADD COLUMN "rejected_notified_at" TIMESTAMP(3);

-- 이미 승인된 서식(예: 기존 3종)은 배포 직후 다시 알리지 않는다.
UPDATE "alimtalk_brand_templates"
SET "approved_notified_at" = "approved_at"
WHERE "approved_at" IS NOT NULL
  AND "approved_notified_at" IS NULL;

UPDATE "alimtalk_brand_templates"
SET "rejected_notified_at" = COALESCE("last_checked_at", "updated_at")
WHERE "status" = 'REJECTED'
  AND "rejected_notified_at" IS NULL;

UPDATE "alimtalk_brand_channels"
SET "linked_notified_at" = COALESCE("linked_at", "requested_at")
WHERE "status" IN ('LINKED', 'ACTIVE', 'DISCONNECTED')
  AND "linked_notified_at" IS NULL;
