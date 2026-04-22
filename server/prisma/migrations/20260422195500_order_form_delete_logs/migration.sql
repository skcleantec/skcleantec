-- 발주서 삭제 로그 테이블
CREATE TABLE "order_form_delete_logs" (
    "id" TEXT NOT NULL,
    "order_form_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "actor_role" VARCHAR(32) NOT NULL,
    "customer_name" TEXT NOT NULL,
    "total_amount" INTEGER NOT NULL,
    "deleted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_form_delete_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_form_delete_logs_order_form_id_deleted_at_idx" ON "order_form_delete_logs"("order_form_id", "deleted_at");
CREATE INDEX "order_form_delete_logs_actor_id_deleted_at_idx" ON "order_form_delete_logs"("actor_id", "deleted_at");

ALTER TABLE "order_form_delete_logs"
ADD CONSTRAINT "order_form_delete_logs_actor_id_fkey"
FOREIGN KEY ("actor_id")
REFERENCES "users"("id")
ON DELETE RESTRICT
ON UPDATE CASCADE;
