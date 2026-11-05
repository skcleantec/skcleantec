ALTER TABLE "order_followups" ADD COLUMN IF NOT EXISTS "is_one_room" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "order_followups" ADD COLUMN IF NOT EXISTS "one_room_loft" BOOLEAN;
ALTER TABLE "order_followups" ADD COLUMN IF NOT EXISTS "one_room_sliding_partition" BOOLEAN;
