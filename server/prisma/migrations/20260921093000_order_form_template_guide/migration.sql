-- 발주서 양식별 고객 안내(업종 기본 + 업체 수정)
ALTER TABLE "order_form_templates" ADD COLUMN IF NOT EXISTS "industry_pack_id" VARCHAR(32);
ALTER TABLE "order_form_templates" ADD COLUMN IF NOT EXISTS "guide_sections" JSONB;
