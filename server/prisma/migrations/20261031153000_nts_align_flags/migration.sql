ALTER TABLE "barobill_members" ADD COLUMN IF NOT EXISTS "nts_taxation_add_tax_allow" INTEGER;
ALTER TABLE "barobill_members" ADD COLUMN IF NOT EXISTS "nts_tax_exemption_add_tax_allow" INTEGER;
ALTER TABLE "barobill_members" ADD COLUMN IF NOT EXISTS "nts_align_failed" BOOLEAN NOT NULL DEFAULT false;
