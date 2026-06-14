-- 고객 열람용 공개 링크 토큰
ALTER TABLE "inquiry_inspection_checklists" ADD COLUMN "customer_view_token" VARCHAR(64);

CREATE UNIQUE INDEX "inquiry_inspection_checklists_customer_view_token_key"
  ON "inquiry_inspection_checklists"("customer_view_token");
