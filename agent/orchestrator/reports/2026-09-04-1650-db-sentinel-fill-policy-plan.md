# DbSentinel — 작성 규칙

- 컬럼: `OrderFormConfig.issueFillPolicy Json?` + `tenant_id` 이미 unique.
- PII 없음. 교환·미러와 무관.
- `migrate`만. 공유 DB `db push` 금지.
- 공개 고객 API에 정책의 **면적 잠금 결과만** 노출. 설정 UI JSON 전체를 공개 토큰에 넣지 않음.
- 로그에 정책 덤프 과다 금지.
