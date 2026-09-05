# DbSentinel — 작성 규칙 v2

- `OrderFormConfig.issueFillRules Json?` + 기존 `tenantId`.
- 값: 칸 키 → `{ customer, marketer, required }`. PII 없음.
- `migrate`만. 공유 DB `db push` 금지.
- 공개 고객 API에는 **이 칸을 보여줄지·잠글지만**. 설정 JSON 전체 노출 금지.
- 연계·미러와 무관.
