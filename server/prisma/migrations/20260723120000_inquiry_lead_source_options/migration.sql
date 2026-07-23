-- 유입 플랫폼 카탈로그(테넌트별) + 부재·보류 lead_source

CREATE TABLE "inquiry_lead_source_options" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "label" VARCHAR(64) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_lead_source_options_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "inquiry_lead_source_options_tenant_id_label_key" ON "inquiry_lead_source_options"("tenant_id", "label");
CREATE INDEX "inquiry_lead_source_options_tenant_id_is_active_sort_order_idx" ON "inquiry_lead_source_options"("tenant_id", "is_active", "sort_order");

ALTER TABLE "inquiry_lead_source_options" ADD CONSTRAINT "inquiry_lead_source_options_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "order_followups" ADD COLUMN "lead_source" VARCHAR(64);

-- 기존 테넌트 기본 5종 시드
INSERT INTO "inquiry_lead_source_options" ("id", "tenant_id", "label", "sort_order", "is_active", "created_at")
SELECT
  gen_random_uuid()::text,
  t."id",
  v.label,
  v.sort_order,
  true,
  CURRENT_TIMESTAMP
FROM "tenants" t
CROSS JOIN (
  VALUES
    ('숨고', 0),
    ('미소', 1),
    ('당근', 2),
    ('네이버', 3),
    ('크린토피아', 4)
) AS v(label, sort_order)
ON CONFLICT ("tenant_id", "label") DO NOTHING;
