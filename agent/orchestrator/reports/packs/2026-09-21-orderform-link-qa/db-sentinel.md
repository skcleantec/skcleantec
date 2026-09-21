# DbSentinel — 발주서 연결

- 발급·목록·프로필 조회 모두 `tenantId`.
- 미리보기 upsert는 고정 미리보기 토큰만. 실제 손님 발주서 templateId를 덮지 않음.
- 안내 JSON은 양식 행. 접수 PII 새로 수집 없음.
- 위약 % 는 토큰. 양식 본문에 숫자 고정 없음.
