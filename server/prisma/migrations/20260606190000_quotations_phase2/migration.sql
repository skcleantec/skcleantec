-- CreateTable
CREATE TABLE "quotation_config" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "footer_notice" TEXT,
    "default_valid_days" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_config_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotation_config_tenant_id_key" ON "quotation_config"("tenant_id");

-- AddForeignKey
ALTER TABLE "quotation_config" ADD CONSTRAINT "quotation_config_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
