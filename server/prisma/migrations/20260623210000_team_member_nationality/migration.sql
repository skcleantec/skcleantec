-- 팀원 국적(KO/TH/MN) — 보조 표시명(name_th) 라벨·용도 구분
ALTER TABLE "team_members" ADD COLUMN "nationality" "CrewUiLanguage" NOT NULL DEFAULT 'KO';
