-- 동적 발주서 필드: 입력란 안 부연설명(placeholder)·단일선택 표시방식(option_style) 추가
ALTER TABLE "order_form_template_fields"
  ADD COLUMN IF NOT EXISTS "placeholder" VARCHAR(300);

ALTER TABLE "order_form_template_fields"
  ADD COLUMN IF NOT EXISTS "option_style" VARCHAR(16);
