-- AlterTable
ALTER TABLE "inquiry_inspection_checklists" ADD COLUMN "completion_pdf_public_id" VARCHAR(512),
ADD COLUMN "completion_pdf_secure_url" VARCHAR(2048);
