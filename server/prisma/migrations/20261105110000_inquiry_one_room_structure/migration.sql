-- 원룸 세부. null = 아직 확인 안 함. is_one_room 이 false 이면 애플리케이션에서 null 로 둔다.
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "one_room_loft" BOOLEAN;
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "one_room_sliding_partition" BOOLEAN;
