-- AlterTable
ALTER TABLE "cs_reports" ADD COLUMN "as_service_date" DATE;

-- CreateIndex
CREATE INDEX "cs_reports_as_service_date_idx" ON "cs_reports"("as_service_date");
