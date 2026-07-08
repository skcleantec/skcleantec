-- CreateTable
CREATE TABLE "telecrm_soomgo_configs" (
    "id" TEXT NOT NULL,
    "tenant_id" TEXT NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_enc" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "telecrm_soomgo_configs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "telecrm_soomgo_configs_tenant_id_key" ON "telecrm_soomgo_configs"("tenant_id");

-- AddForeignKey
ALTER TABLE "telecrm_soomgo_configs" ADD CONSTRAINT "telecrm_soomgo_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
