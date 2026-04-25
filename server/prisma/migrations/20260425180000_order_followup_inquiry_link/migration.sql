-- 부재현황 ↔ 접수 통합(1단계): 선택적 FK
ALTER TABLE "order_followups" ADD COLUMN IF NOT EXISTS "inquiry_id" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'order_followups_inquiry_id_fkey'
  ) THEN
    ALTER TABLE "order_followups"
      ADD CONSTRAINT "order_followups_inquiry_id_fkey"
      FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "order_followups_inquiry_id_idx" ON "order_followups" ("inquiry_id");
