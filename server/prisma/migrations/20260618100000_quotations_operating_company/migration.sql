-- 견적서별 영업 브랜드 (제목: {브랜드명} 견적서)
ALTER TABLE "quotations" ADD COLUMN "operating_company_id" TEXT;

ALTER TABLE "quotations" ADD CONSTRAINT "quotations_operating_company_id_fkey"
  FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "quotations_tenant_id_operating_company_id_idx"
  ON "quotations"("tenant_id", "operating_company_id");
