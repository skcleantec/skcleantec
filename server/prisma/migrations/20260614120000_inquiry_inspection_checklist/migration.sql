-- CreateEnum
CREATE TYPE "InquiryInspectionStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'AWAITING_CUSTOMER', 'COMPLETED', 'VOID');

-- CreateEnum
CREATE TYPE "InspectionAreaPhotoPhase" AS ENUM ('BEFORE', 'AFTER');

-- CreateTable
CREATE TABLE "inquiry_inspection_checklists" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "inquiry_id" TEXT NOT NULL,
    "team_leader_id" TEXT NOT NULL,
    "status" "InquiryInspectionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "template_version" VARCHAR(16) NOT NULL DEFAULT 'v1',
    "customer_email" VARCHAR(256),
    "leader_notes" TEXT,
    "basic_answers_json" JSONB NOT NULL DEFAULT '{}',
    "consent_snapshot_json" JSONB,
    "consent_personal_info" BOOLEAN NOT NULL DEFAULT false,
    "consent_third_party" BOOLEAN NOT NULL DEFAULT false,
    "consent_scope_confirm" BOOLEAN NOT NULL DEFAULT false,
    "consent_leader_liability" BOOLEAN NOT NULL DEFAULT false,
    "consent_customer_confirm" BOOLEAN NOT NULL DEFAULT false,
    "consent_commercial_use" BOOLEAN NOT NULL DEFAULT false,
    "consent_email_delivery" BOOLEAN NOT NULL DEFAULT false,
    "signature_public_id" VARCHAR(512),
    "signature_secure_url" VARCHAR(2048),
    "completed_at" TIMESTAMP(3),
    "voided_at" TIMESTAMP(3),
    "voided_by_id" TEXT,
    "void_reason" TEXT,
    "email_sent_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiry_inspection_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_inspection_areas" (
    "id" TEXT NOT NULL,
    "checklist_id" TEXT NOT NULL,
    "area_key" VARCHAR(64) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_custom" BOOLEAN NOT NULL DEFAULT false,
    "not_applicable" BOOLEAN NOT NULL DEFAULT false,
    "na_reason" VARCHAR(500),

    CONSTRAINT "inquiry_inspection_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_inspection_area_photos" (
    "id" TEXT NOT NULL,
    "area_id" TEXT NOT NULL,
    "phase" "InspectionAreaPhotoPhase" NOT NULL,
    "cloudinary_public_id" VARCHAR(512) NOT NULL,
    "secure_url" VARCHAR(1024) NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "uploaded_by_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_inspection_area_photos_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inquiry_inspection_checklists_inquiry_id_key" ON "inquiry_inspection_checklists"("inquiry_id");

-- CreateIndex
CREATE INDEX "inquiry_inspection_checklists_tenant_id_status_idx" ON "inquiry_inspection_checklists"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "inquiry_inspection_checklists_tenant_id_inquiry_id_idx" ON "inquiry_inspection_checklists"("tenant_id", "inquiry_id");

-- CreateIndex
CREATE UNIQUE INDEX "inquiry_inspection_areas_checklist_id_area_key_key" ON "inquiry_inspection_areas"("checklist_id", "area_key");

-- CreateIndex
CREATE INDEX "inquiry_inspection_areas_checklist_id_sort_order_idx" ON "inquiry_inspection_areas"("checklist_id", "sort_order");

-- CreateIndex
CREATE INDEX "inquiry_inspection_area_photos_area_id_phase_created_at_idx" ON "inquiry_inspection_area_photos"("area_id", "phase", "created_at");

-- AddForeignKey
ALTER TABLE "inquiry_inspection_checklists" ADD CONSTRAINT "inquiry_inspection_checklists_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_inspection_checklists" ADD CONSTRAINT "inquiry_inspection_checklists_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_inspection_checklists" ADD CONSTRAINT "inquiry_inspection_checklists_team_leader_id_fkey" FOREIGN KEY ("team_leader_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_inspection_checklists" ADD CONSTRAINT "inquiry_inspection_checklists_voided_by_id_fkey" FOREIGN KEY ("voided_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_inspection_areas" ADD CONSTRAINT "inquiry_inspection_areas_checklist_id_fkey" FOREIGN KEY ("checklist_id") REFERENCES "inquiry_inspection_checklists"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_inspection_area_photos" ADD CONSTRAINT "inquiry_inspection_area_photos_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "inquiry_inspection_areas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_inspection_area_photos" ADD CONSTRAINT "inquiry_inspection_area_photos_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
