-- 플랫폼 SMTP (입금 확인·도움말 문의 등)
ALTER TABLE "platform_billing_settings"
  ADD COLUMN IF NOT EXISTS "smtp_host" VARCHAR(256),
  ADD COLUMN IF NOT EXISTS "smtp_port" INTEGER,
  ADD COLUMN IF NOT EXISTS "smtp_secure" BOOLEAN,
  ADD COLUMN IF NOT EXISTS "smtp_user" VARCHAR(256),
  ADD COLUMN IF NOT EXISTS "smtp_from" VARCHAR(256),
  ADD COLUMN IF NOT EXISTS "smtp_pass_enc" TEXT;
