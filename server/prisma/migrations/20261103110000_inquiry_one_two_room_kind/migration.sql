-- SK 원/투룸 구분: is_two_room boolean → one_two_room_kind ('ONE' | 'TWO')
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "one_two_room_kind" TEXT;

UPDATE "inquiries"
SET "one_two_room_kind" = 'TWO'
WHERE "is_two_room" IS TRUE
  AND "one_two_room_kind" IS NULL;

ALTER TABLE "inquiries" DROP COLUMN IF EXISTS "is_two_room";
