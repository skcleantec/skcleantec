-- 매칭 없이 발행할 수 있게 접수 연결을 비운다. 품목명을 남긴다.
ALTER TABLE "cash_bill_issues" ALTER COLUMN "inquiry_id" DROP NOT NULL;

ALTER TABLE "cash_bill_issues" ADD COLUMN "item_name" VARCHAR(50) NOT NULL DEFAULT '청소 서비스';
