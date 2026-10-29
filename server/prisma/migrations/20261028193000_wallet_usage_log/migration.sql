-- 청소비서 지갑 사용 원장. 기존 테이블 이름은 바꾸지 않는다.
-- 현금영수증·세금계산서 차감이 충전 원장에 메모로만 있던 행은 사용 원장으로 옮긴다.

CREATE TABLE "tenant_wallet_usage_logs" (
  "id" TEXT NOT NULL,
  "tenant_id" TEXT NOT NULL,
  "type" VARCHAR(32) NOT NULL,
  "ref_id" VARCHAR(64),
  "amount_krw" INTEGER NOT NULL,
  "balance_after_krw" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "tenant_wallet_usage_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "tenant_wallet_usage_logs_tenant_id_created_at_idx"
  ON "tenant_wallet_usage_logs" ("tenant_id", "created_at" DESC);

CREATE INDEX "tenant_wallet_usage_logs_tenant_id_type_created_at_idx"
  ON "tenant_wallet_usage_logs" ("tenant_id", "type", "created_at" DESC);

ALTER TABLE "tenant_wallet_usage_logs"
  ADD CONSTRAINT "tenant_wallet_usage_logs_tenant_id_fkey"
  FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "tenant_wallet_usage_logs" (
  "id", "tenant_id", "type", "ref_id", "amount_krw", "balance_after_krw", "created_at"
)
SELECT
  "id",
  "tenant_id",
  CASE "memo"
    WHEN '현금영수증' THEN 'CASHBILL_ISSUE'
    WHEN '현금영수증 차감 취소' THEN 'CASHBILL_REFUND'
    WHEN '세금계산서' THEN 'TAXINVOICE_ISSUE'
    WHEN '세금계산서 차감 취소' THEN 'TAXINVOICE_REFUND'
  END,
  NULL,
  "amount_krw",
  "balance_after_krw",
  "created_at"
FROM "alimtalk_wallet_charge_logs"
WHERE "memo" IN (
  '현금영수증',
  '현금영수증 차감 취소',
  '세금계산서',
  '세금계산서 차감 취소'
);

DELETE FROM "alimtalk_wallet_charge_logs"
WHERE "memo" IN (
  '현금영수증',
  '현금영수증 차감 취소',
  '세금계산서',
  '세금계산서 차감 취소'
);
