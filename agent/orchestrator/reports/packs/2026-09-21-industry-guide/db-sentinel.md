# DbSentinel — 발주서별 안내

- 컬럼: `order_form_templates.industry_pack_id`, `guide_sections` (JSON).
- 업무 조회 `findFirst({ where: { id, tenantId } })`.
- 손님 안내는 양식 행. 접수 PII를 새로 모으지 않음.
- 위약 % 숫자는 안내 JSON에 넣지 않고 `{{cancellationPolicy}}` 만.
