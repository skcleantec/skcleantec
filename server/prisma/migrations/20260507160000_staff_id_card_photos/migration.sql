-- 사원증 이미지(Cloudinary) — 팀장·마케터·현장 팀원

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "staff_id_card_public_id" VARCHAR(512);
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "staff_id_card_url" VARCHAR(2048);

ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "staff_id_card_public_id" VARCHAR(512);
ALTER TABLE "team_members" ADD COLUMN IF NOT EXISTS "staff_id_card_url" VARCHAR(2048);
