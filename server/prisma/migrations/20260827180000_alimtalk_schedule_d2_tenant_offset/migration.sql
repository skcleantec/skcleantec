-- 일정 확인 알림톡 — 테넌트별 위약 발생일 N일 전 발송
ALTER TABLE "tenant_alimtalk_template_settings"
ADD COLUMN IF NOT EXISTS "schedule_d2_days_before_penalty" INTEGER;
