-- 광고비 채널별 정산 방식(DIRECT_AMOUNT | COUNT_LINES) 및 과목(건당 금액) 테이블

CREATE TYPE "AdChannelSettlementMode" AS ENUM ('DIRECT_AMOUNT', 'COUNT_LINES');

ALTER TABLE "ad_channels" ADD COLUMN "settlement_mode" "AdChannelSettlementMode" NOT NULL DEFAULT 'DIRECT_AMOUNT';

CREATE TABLE "ad_channel_line_items" (
    "id" TEXT NOT NULL,
    "channel_id" TEXT NOT NULL,
    "label" VARCHAR(128) NOT NULL,
    "unit_amount_won" INTEGER NOT NULL,
    "counts_for_spend" BOOLEAN NOT NULL DEFAULT true,
    "use_as_avg_denominator" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_channel_line_items_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ad_channel_line_items_channel_id_sort_order_idx" ON "ad_channel_line_items"("channel_id", "sort_order");

ALTER TABLE "ad_channel_line_items" ADD CONSTRAINT "ad_channel_line_items_channel_id_fkey" FOREIGN KEY ("channel_id") REFERENCES "ad_channels"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ad_spend_lines" ADD COLUMN "count_breakdown" JSONB;

-- 이름에 숨고/soomgo 포함 채널은 기존 로직과 동일 단가로 건수 과목 3개 부여
UPDATE "ad_channels"
SET "settlement_mode" = 'COUNT_LINES'
WHERE LOWER("name") LIKE '%숨고%' OR LOWER("name") LIKE '%soomgo%';

INSERT INTO "ad_channel_line_items" ("id", "channel_id", "label", "unit_amount_won", "counts_for_spend", "use_as_avg_denominator", "sort_order", "created_at")
SELECT gen_random_uuid()::text, c.id, v.label, v.unit, v.cfs, v.uad, v.so, CURRENT_TIMESTAMP
FROM "ad_channels" c
CROSS JOIN (VALUES
  ('받은요청', 3800, true, false, 0),
  ('자동견적', 3500, true, false, 1),
  ('예약확정', 0, false, true, 2)
) AS v(label, unit, cfs, uad, so)
WHERE c."settlement_mode" = 'COUNT_LINES'
AND NOT EXISTS (SELECT 1 FROM "ad_channel_line_items" i WHERE i.channel_id = c.id);
