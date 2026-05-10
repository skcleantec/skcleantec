-- 평균 분모: 예약(고객 발주서 제출) 건수 — 자동 집계 또는 수동 입력 스냅샷
ALTER TABLE "ad_work_sessions" ADD COLUMN "booking_denominator_count" INTEGER;
ALTER TABLE "ad_work_sessions" ADD COLUMN "booking_denominator_manual" BOOLEAN NOT NULL DEFAULT false;
