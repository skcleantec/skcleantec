-- Phase 2: TenantFeature (per-tenant module on/off overrides)

CREATE TABLE "tenant_features" (
    "tenant_id" TEXT NOT NULL,
    "module_id" VARCHAR(64) NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "meta" JSONB NOT NULL DEFAULT '{}',

    CONSTRAINT "tenant_features_pkey" PRIMARY KEY ("tenant_id","module_id")
);

ALTER TABLE "tenant_features" ADD CONSTRAINT "tenant_features_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
