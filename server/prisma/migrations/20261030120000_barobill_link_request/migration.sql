-- 바로빌 연결 요청 시각과 아이디 힌트. 기존 행은 NULL.
ALTER TABLE "barobill_members" ADD COLUMN IF NOT EXISTS "link_requested_at" TIMESTAMP(3);
ALTER TABLE "barobill_members" ADD COLUMN IF NOT EXISTS "link_request_user_id_hint" VARCHAR(20);
