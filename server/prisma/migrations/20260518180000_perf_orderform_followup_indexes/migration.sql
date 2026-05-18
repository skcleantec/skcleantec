-- 발주서 목록 ORDER BY createdAt DESC 부하 완화
CREATE INDEX "order_forms_created_at_idx" ON "order_forms" ("created_at" DESC);

-- 부재·보류 목록 WHERE status IN (...) ORDER BY createdAt DESC 완화
CREATE INDEX "order_followups_status_created_at_idx" ON "order_followups" ("status", "created_at" DESC);
