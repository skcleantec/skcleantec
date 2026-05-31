-- 발주서 렌더 방식 통일: 사용자 토글 제거.
-- 규칙: 기본 발주서(is_default=true)는 표준 폼 전체(STANDARD), 그 외 내가 만든 발주서는 항목 구동(TEMPLATE).
UPDATE "order_form_templates" SET "render_mode" = 'TEMPLATE' WHERE "is_default" = false;
UPDATE "order_form_templates" SET "render_mode" = 'STANDARD' WHERE "is_default" = true;
