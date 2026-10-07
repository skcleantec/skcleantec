-- 원성페이먼츠가 가맹 코드를 입력하는 신청별 주소
ALTER TABLE "tenant_pg_onboardings" ADD COLUMN IF NOT EXISTS "review_token" VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS "tenant_pg_onboardings_review_token_key" ON "tenant_pg_onboardings" ("review_token");
