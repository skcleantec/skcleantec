-- SK 원/투룸 중 투룸 구분. 기존 행은 원룸으로 둔다.
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "is_two_room" BOOLEAN NOT NULL DEFAULT false;
