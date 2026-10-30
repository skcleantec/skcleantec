-- 바로빌 아이디(언더바 포함, 최대 50자)만 넓힌다.
ALTER TABLE "barobill_members" ALTER COLUMN "barobill_user_id" TYPE VARCHAR(50);
ALTER TABLE "barobill_members" ALTER COLUMN "link_request_user_id_hint" TYPE VARCHAR(50);
