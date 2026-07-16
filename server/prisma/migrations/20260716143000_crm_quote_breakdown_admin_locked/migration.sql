-- 텔레CRM 견적 내역(crmQuoteBreakdown) — 고객 발주서에 노출하지 않음(관리자 고정)
UPDATE "order_form_template_fields"
SET "fill_mode" = 'ADMIN_LOCKED'
WHERE "field_key" = 'crmQuoteBreakdown'
  AND "fill_mode" <> 'ADMIN_LOCKED';
