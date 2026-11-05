ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "structure_balcony_non_expanded" BOOLEAN;
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "structure_partition_wall" BOOLEAN;
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "structure_outdoor_terrace" BOOLEAN;
ALTER TABLE "order_followups" ADD COLUMN IF NOT EXISTS "structure_balcony_non_expanded" BOOLEAN;
ALTER TABLE "order_followups" ADD COLUMN IF NOT EXISTS "structure_partition_wall" BOOLEAN;
ALTER TABLE "order_followups" ADD COLUMN IF NOT EXISTS "structure_outdoor_terrace" BOOLEAN;
