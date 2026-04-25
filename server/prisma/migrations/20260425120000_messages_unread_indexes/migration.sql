-- 미읽음 배지 COUNT: WHERE receiver_id = ? AND read_at IS NULL
CREATE INDEX IF NOT EXISTS "messages_receiver_id_read_at_idx" ON "messages" ("receiver_id", "read_at");

-- 1:1 스레드 목록: OR(sender_id, receiver_id) 쌍 + created_at 정렬
CREATE INDEX IF NOT EXISTS "messages_sender_id_receiver_id_created_at_idx" ON "messages" ("sender_id", "receiver_id", "created_at");
