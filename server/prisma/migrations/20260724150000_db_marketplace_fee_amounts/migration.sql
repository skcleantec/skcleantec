-- 정보공유 — 고객 잔금·누적 수수료 분리 (priorFeesTotal, buyerTotalFee)

ALTER TABLE "inquiry_db_listings"
  ADD COLUMN IF NOT EXISTS "prior_fees_total" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "buyer_total_fee" INTEGER NOT NULL DEFAULT 0;

-- 1차: 최초 판매
UPDATE "inquiry_db_listings"
SET
  "prior_fees_total" = 0,
  "buyer_total_fee" = "listing_fee"
WHERE "parent_listing_id" IS NULL;

-- 2차: 재판매 (부모 buyer_total_fee + 본인 listing_fee)
UPDATE "inquiry_db_listings" AS child
SET
  "prior_fees_total" = parent."buyer_total_fee",
  "buyer_total_fee" = parent."buyer_total_fee" + child."listing_fee"
FROM "inquiry_db_listings" AS parent
WHERE child."parent_listing_id" = parent."id";

-- display_amount = 고객 잔금(deal_balance 또는 접수 잔금), net 차감 아님
UPDATE "inquiry_db_listings" AS listing
SET "display_amount" = COALESCE(listing."deal_balance_amount", inquiry."service_balance_amount")
FROM "inquiries" AS inquiry
WHERE inquiry."id" = listing."inquiry_id"
  AND COALESCE(listing."deal_balance_amount", inquiry."service_balance_amount") IS NOT NULL
  AND COALESCE(listing."deal_balance_amount", inquiry."service_balance_amount") > 0;
