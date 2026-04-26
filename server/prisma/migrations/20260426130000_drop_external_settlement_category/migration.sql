-- 타업체 정산 항목(4~7) 분류 제거 — 미수·지급은 external_transfer_fee·업체·월 단위만 사용
ALTER TABLE "inquiries" DROP COLUMN IF EXISTS "external_settlement_category";
