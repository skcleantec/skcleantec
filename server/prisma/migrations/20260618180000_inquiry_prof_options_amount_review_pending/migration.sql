-- 고객 발주서 전문 시공 옵션 선택 후 마케터 금액 확정 대기
ALTER TABLE "inquiries" ADD COLUMN "prof_options_amount_review_pending" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX "inquiries_tenant_id_prof_options_amount_review_pending_idx"
  ON "inquiries"("tenant_id", "prof_options_amount_review_pending");
