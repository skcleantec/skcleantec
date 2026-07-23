-- 접수 경로(intake_channel) — 유입 플랫폼(source)과 분리

ALTER TABLE "inquiries" ADD COLUMN "intake_channel" VARCHAR(32);

UPDATE "inquiries" SET "intake_channel" = 'phone'
WHERE "source" = '전화' AND "intake_channel" IS NULL;

UPDATE "inquiries" SET "intake_channel" = 'manual'
WHERE "intake_channel" IS NULL
  AND ("source" LIKE '%수기등록%' OR "source" LIKE '%외부업체%');

UPDATE "inquiries" i SET "intake_channel" = 'order_form_submit'
FROM "order_forms" of
WHERE i."order_form_id" = of."id"
  AND of."submitted_at" IS NOT NULL
  AND i."source" = '발주서'
  AND i."intake_channel" IS NULL;

UPDATE "inquiries" SET "intake_channel" = 'order_form_submit'
WHERE "source" = '발주서' AND "intake_channel" IS NULL;

UPDATE "inquiries" i SET "intake_channel" = 'telecrm'
WHERE i."intake_channel" IS NULL
  AND EXISTS (
    SELECT 1 FROM "inquiry_change_logs" cl
    WHERE cl."inquiry_id" = i."id"
      AND cl."lines"::text LIKE '%텔레CRM%'
  );

UPDATE "inquiries" i SET "intake_channel" = 'order_issue'
WHERE i."intake_channel" IS NULL
  AND EXISTS (
    SELECT 1 FROM "inquiry_change_logs" cl
    WHERE cl."inquiry_id" = i."id"
      AND cl."lines"::text LIKE '%발주서 발급%'
  );
