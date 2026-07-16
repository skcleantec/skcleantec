-- 발주서 템플릿 필드 — 접수 목록 노출 플래그
ALTER TABLE "order_form_template_fields" ADD COLUMN IF NOT EXISTS "show_in_inquiry_list" BOOLEAN NOT NULL DEFAULT false;

-- 접수 — 발주서 추가 항목 목록용 스냅샷 (제출 시 고정)
ALTER TABLE "inquiries" ADD COLUMN IF NOT EXISTS "order_form_list_snapshot" JSONB;
