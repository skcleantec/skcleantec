-- 접수 목록·필터·정렬에 맞춘 인덱스 + 팀장 필터용 배정 인덱스
CREATE INDEX IF NOT EXISTS "inquiries_created_at_idx" ON "inquiries" ("created_at");
CREATE INDEX IF NOT EXISTS "inquiries_preferred_date_idx" ON "inquiries" ("preferred_date");
CREATE INDEX IF NOT EXISTS "inquiries_status_created_at_idx" ON "inquiries" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "inquiries_created_by_id_idx" ON "inquiries" ("created_by_id");
CREATE INDEX IF NOT EXISTS "assignments_team_leader_id_idx" ON "assignments" ("team_leader_id");
