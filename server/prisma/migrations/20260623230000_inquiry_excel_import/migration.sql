-- CreateEnum
CREATE TYPE "InquiryExcelImportRunStatus" AS ENUM ('PREVIEW', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateTable
CREATE TABLE "inquiry_excel_import_profiles" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "name" VARCHAR(128) NOT NULL,
    "mapping_spec" JSONB NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "inquiry_excel_import_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inquiry_excel_import_runs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "profile_id" TEXT,
    "file_name" VARCHAR(256),
    "total_rows" INTEGER NOT NULL,
    "created_count" INTEGER NOT NULL DEFAULT 0,
    "skipped_count" INTEGER NOT NULL DEFAULT 0,
    "error_count" INTEGER NOT NULL DEFAULT 0,
    "row_results" JSONB NOT NULL DEFAULT '[]',
    "status" "InquiryExcelImportRunStatus" NOT NULL DEFAULT 'COMPLETED',
    "actor_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inquiry_excel_import_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "inquiry_excel_import_profiles_tenant_id_is_active_updated_at_idx" ON "inquiry_excel_import_profiles"("tenant_id", "is_active", "updated_at" DESC);

-- CreateIndex
CREATE INDEX "inquiry_excel_import_runs_tenant_id_created_at_idx" ON "inquiry_excel_import_runs"("tenant_id", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "inquiry_excel_import_profiles" ADD CONSTRAINT "inquiry_excel_import_profiles_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_excel_import_profiles" ADD CONSTRAINT "inquiry_excel_import_profiles_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_excel_import_runs" ADD CONSTRAINT "inquiry_excel_import_runs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_excel_import_runs" ADD CONSTRAINT "inquiry_excel_import_runs_profile_id_fkey" FOREIGN KEY ("profile_id") REFERENCES "inquiry_excel_import_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inquiry_excel_import_runs" ADD CONSTRAINT "inquiry_excel_import_runs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
