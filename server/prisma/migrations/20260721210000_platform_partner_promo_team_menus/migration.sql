-- 타업체 팀 메뉴별 배너 노출 (대시보드·접수목록·스케줄)
ALTER TABLE "platform_partner_promos" ADD COLUMN "show_on_team_dashboard" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "platform_partner_promos" ADD COLUMN "show_on_team_assignments" BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE "platform_partner_promos" ADD COLUMN "show_on_team_schedule" BOOLEAN NOT NULL DEFAULT true;
