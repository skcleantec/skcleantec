-- 발급 시 마케터가 지정한 청소 면적(공급/전용 + 평). 지정 시 고객 발주서에서 수정 불가.
ALTER TABLE "order_forms" ADD COLUMN "area_pyeong" DOUBLE PRECISION;
ALTER TABLE "order_forms" ADD COLUMN "area_basis" TEXT;
