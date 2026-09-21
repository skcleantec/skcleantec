-- AlterTable
ALTER TABLE "inquiries" ADD COLUMN "intake_template_id" TEXT;

-- CreateIndex
CREATE INDEX "inquiries_tenant_id_intake_template_id_idx" ON "inquiries"("tenant_id", "intake_template_id");

-- AddForeignKey
ALTER TABLE "inquiries" ADD CONSTRAINT "inquiries_intake_template_id_fkey" FOREIGN KEY ("intake_template_id") REFERENCES "order_form_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
