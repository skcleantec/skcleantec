-- 타업체 정산 목록(company-overview-list) — fee 있는 inquiry만 빠르게 스캔
CREATE INDEX IF NOT EXISTS "inquiries_tenant_oc_external_fee_idx"
  ON "inquiries" ("tenant_id", "operating_company_id")
  WHERE "external_transfer_fee" IS NOT NULL;

-- 타업체 배정 assignment — fee inquiry 조인용
CREATE INDEX IF NOT EXISTS "assignments_tenant_inquiry_sort_idx"
  ON "assignments" ("tenant_id", "inquiry_id", "sort_order");
