-- 부재현황(발주서 후속) — 고객 연락·예약금·보류 추적
CREATE TYPE "OrderFollowupStatus" AS ENUM ('ABSENT', 'DEPOSIT_PENDING', 'ON_HOLD', 'RESERVED', 'FULFILLED');

CREATE TABLE "order_followups" (
    "id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "status" "OrderFollowupStatus" NOT NULL,
    "defer_count" INTEGER NOT NULL DEFAULT 0,
    "memo" TEXT,
    "next_contact_at" TIMESTAMP(3),
    "deposit_received_at" TIMESTAMP(3),
    "linked_order_form_id" TEXT,
    "created_by_id" TEXT NOT NULL,
    "handled_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "order_followups_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "order_followups_linked_order_form_id_key" ON "order_followups"("linked_order_form_id");

CREATE INDEX "order_followups_status_updated_at_idx" ON "order_followups"("status", "updated_at");

CREATE INDEX "order_followups_handled_by_id_idx" ON "order_followups"("handled_by_id");

CREATE TABLE "order_followup_logs" (
    "id" TEXT NOT NULL,
    "followup_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "action" VARCHAR(64) NOT NULL,
    "detail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_followup_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "order_followup_logs_followup_id_created_at_idx" ON "order_followup_logs"("followup_id", "created_at");

ALTER TABLE "order_followups" ADD CONSTRAINT "order_followups_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "order_followups" ADD CONSTRAINT "order_followups_handled_by_id_fkey" FOREIGN KEY ("handled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_followups" ADD CONSTRAINT "order_followups_linked_order_form_id_fkey" FOREIGN KEY ("linked_order_form_id") REFERENCES "order_forms"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "order_followup_logs" ADD CONSTRAINT "order_followup_logs_followup_id_fkey" FOREIGN KEY ("followup_id") REFERENCES "order_followups"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_followup_logs" ADD CONSTRAINT "order_followup_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
