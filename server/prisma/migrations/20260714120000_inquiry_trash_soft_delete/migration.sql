-- AlterTable
ALTER TABLE "inquiries" ADD COLUMN "deleted_at" TIMESTAMP(3),
ADD COLUMN "deleted_by_id" TEXT;

-- CreateIndex
CREATE INDEX "inquiries_tenant_id_deleted_at_idx" ON "inquiries"("tenant_id", "deleted_at");

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_deleted_by_id_fkey" FOREIGN KEY ("deleted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
