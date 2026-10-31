ALTER TABLE "cash_bill_issues" ADD COLUMN IF NOT EXISTS "customer_name" VARCHAR(64);

UPDATE "cash_bill_issues" AS c
SET "customer_name" = LEFT(i."customer_name", 64)
FROM "inquiries" AS i
WHERE c."inquiry_id" = i."id" AND c."customer_name" IS NULL;
