-- 공개 발주서 렌더 방식: STANDARD(표준 폼 전체) / TEMPLATE(템플릿 항목만)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'OrderFormTemplateRenderMode') THEN
    CREATE TYPE "OrderFormTemplateRenderMode" AS ENUM ('STANDARD', 'TEMPLATE');
  END IF;
END
$$;

ALTER TABLE "order_form_templates"
  ADD COLUMN IF NOT EXISTS "render_mode" "OrderFormTemplateRenderMode" NOT NULL DEFAULT 'STANDARD';
