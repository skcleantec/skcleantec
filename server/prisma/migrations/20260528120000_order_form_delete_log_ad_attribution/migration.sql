-- 발주서 삭제 로그 — 광고 예약 분모 삭제 건수 귀속용 스냅샷
ALTER TABLE "order_form_delete_logs" ADD COLUMN "created_by_id" TEXT;
ALTER TABLE "order_form_delete_logs" ADD COLUMN "submitted_at" TIMESTAMP(3);
ALTER TABLE "order_form_delete_logs" ADD COLUMN "order_form_created_at" TIMESTAMP(3);

UPDATE "order_form_delete_logs"
SET
  "created_by_id" = "actor_id",
  "order_form_created_at" = "deleted_at"
WHERE "created_by_id" IS NULL;

ALTER TABLE "order_form_delete_logs" ALTER COLUMN "created_by_id" SET NOT NULL;
ALTER TABLE "order_form_delete_logs" ALTER COLUMN "order_form_created_at" SET NOT NULL;

ALTER TABLE "order_form_delete_logs"
ADD CONSTRAINT "order_form_delete_logs_created_by_id_fkey"
FOREIGN KEY ("created_by_id")
REFERENCES "users"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;

CREATE INDEX "order_form_delete_logs_created_by_id_submitted_at_idx"
ON "order_form_delete_logs"("created_by_id", "submitted_at");

CREATE INDEX "order_form_delete_logs_created_by_id_order_form_created_at_idx"
ON "order_form_delete_logs"("created_by_id", "order_form_created_at");
