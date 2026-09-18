-- 업체별 전화·수기 접수 칸. null = 입주청소 칸 전부(기존과 동일)
ALTER TABLE "tenants" ADD COLUMN IF NOT EXISTS "inquiry_intake_system_field_keys" JSONB;
