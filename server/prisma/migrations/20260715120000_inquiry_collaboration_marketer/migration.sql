-- 협업 마케터(기록용) — 광고비·마케터 집계와 분리
ALTER TABLE "inquiries" ADD COLUMN "collaboration_marketer_id" TEXT;

CREATE INDEX "inquiries_tenant_id_collaboration_marketer_id_idx"
  ON "inquiries"("tenant_id", "collaboration_marketer_id");

ALTER TABLE "inquiries"
  ADD CONSTRAINT "inquiries_collaboration_marketer_id_fkey"
  FOREIGN KEY ("collaboration_marketer_id") REFERENCES "users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
