-- 전용면적 기준일 때 고객이 참고로 적는 제곱미터(㎡). 평수(area_pyeong)와 별도.
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "exclusive_area_sqm" DOUBLE PRECISION;
