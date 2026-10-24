ALTER TABLE "schedule_staff_notice_boards"
ADD COLUMN IF NOT EXISTS "body_height_px" INTEGER NOT NULL DEFAULT 176;
