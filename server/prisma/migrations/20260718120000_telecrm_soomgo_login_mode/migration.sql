-- TelecrmSoomgoConfig: 숨고 로그인 방식 (email | kakao)
ALTER TABLE "telecrm_soomgo_configs"
  ADD COLUMN IF NOT EXISTS "login_mode" VARCHAR(20) NOT NULL DEFAULT 'email';
