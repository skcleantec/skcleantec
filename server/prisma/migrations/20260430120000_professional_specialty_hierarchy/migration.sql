-- 대분류·상세 옵션 계층 + 가격(원)
ALTER TABLE "professional_specialty_options" ADD COLUMN "parent_id" TEXT;
ALTER TABLE "professional_specialty_options" ADD COLUMN "is_group" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "professional_specialty_options" ADD COLUMN "price_amount" INTEGER;

CREATE INDEX "professional_specialty_options_parent_id_sort_order_idx" ON "professional_specialty_options"("parent_id", "sort_order");

ALTER TABLE "professional_specialty_options"
  ADD CONSTRAINT "professional_specialty_options_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "professional_specialty_options"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
