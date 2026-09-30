-- AI 미리 배정: 피로의 정상 주는 근무일 6일, 건수 12건.
ALTER TABLE "tenant_ai_dispatch_settings"
ADD COLUMN "normal_work_days_per_week" INTEGER NOT NULL DEFAULT 6,
ADD COLUMN "normal_jobs_per_week" INTEGER NOT NULL DEFAULT 12;
