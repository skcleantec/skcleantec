-- AI 미리 배정: 팀원을 피로 점수에 넣을지. 기본은 넣지 않음.
ALTER TABLE "tenant_ai_dispatch_settings"
ADD COLUMN "include_crew_in_fatigue" BOOLEAN NOT NULL DEFAULT false;
