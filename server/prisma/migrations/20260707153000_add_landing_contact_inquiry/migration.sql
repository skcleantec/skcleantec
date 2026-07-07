-- CreateTable
CREATE TABLE "landing_contact_form_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "title" VARCHAR(200),
    "intro_text" TEXT,
    "custom_fields" JSONB NOT NULL DEFAULT '[]',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_contact_form_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "landing_contact_inquiries" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "operating_company_id" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "custom_field_values" JSONB NOT NULL DEFAULT '{}',
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "source" TEXT NOT NULL DEFAULT 'hosted_form',
    "source_page_url" TEXT,
    "inquiry_id" TEXT,
    "memo" TEXT,
    "assigned_to_id" TEXT,
    "converted_by_id" TEXT,
    "converted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "landing_contact_inquiries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "landing_contact_form_configs_tenant_id_idx" ON "landing_contact_form_configs"("tenant_id");

-- CreateIndex
CREATE UNIQUE INDEX "landing_contact_form_configs_tenant_id_operating_company_id_key" ON "landing_contact_form_configs"("tenant_id", "operating_company_id");

-- CreateIndex
CREATE INDEX "landing_contact_inquiries_tenant_id_created_at_idx" ON "landing_contact_inquiries"("tenant_id", "created_at");

-- CreateIndex
CREATE INDEX "landing_contact_inquiries_tenant_id_status_idx" ON "landing_contact_inquiries"("tenant_id", "status");

-- CreateIndex
CREATE INDEX "landing_contact_inquiries_tenant_id_operating_company_id_idx" ON "landing_contact_inquiries"("tenant_id", "operating_company_id");

-- CreateIndex
CREATE INDEX "landing_contact_inquiries_inquiry_id_idx" ON "landing_contact_inquiries"("inquiry_id");

-- AddForeignKey
ALTER TABLE "landing_contact_form_configs" ADD CONSTRAINT "landing_contact_form_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_contact_form_configs" ADD CONSTRAINT "landing_contact_form_configs_operating_company_id_fkey" FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_contact_inquiries" ADD CONSTRAINT "landing_contact_inquiries_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_contact_inquiries" ADD CONSTRAINT "landing_contact_inquiries_operating_company_id_fkey" FOREIGN KEY ("operating_company_id") REFERENCES "operating_companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_contact_inquiries" ADD CONSTRAINT "landing_contact_inquiries_inquiry_id_fkey" FOREIGN KEY ("inquiry_id") REFERENCES "inquiries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_contact_inquiries" ADD CONSTRAINT "landing_contact_inquiries_assigned_to_id_fkey" FOREIGN KEY ("assigned_to_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "landing_contact_inquiries" ADD CONSTRAINT "landing_contact_inquiries_converted_by_id_fkey" FOREIGN KEY ("converted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
