-- AlterTable
ALTER TABLE "cs_reports" ADD COLUMN "forwarded_to_user_id" TEXT;

-- CreateIndex
CREATE INDEX "cs_reports_forwarded_to_user_id_idx" ON "cs_reports"("forwarded_to_user_id");

-- AddForeignKey
ALTER TABLE "cs_reports" ADD CONSTRAINT "cs_reports_forwarded_to_user_id_fkey" FOREIGN KEY ("forwarded_to_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
