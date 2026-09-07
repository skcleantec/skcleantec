# DbSentinel — 사진첨부 토글

스키마·마이그레이션 **불필요**. 기존 `OrderFormTemplateField.systemField = 'photos'` 재사용.

- 업로드는 이미 테넌트·토큰 스코프. OFF일 때 POST를 막으면 우회 업로드 방지.
- 새 PII 컬럼 없음. 끈다고 기존 `OrderFormPhoto` 행을 지우지 말 것.
- 플랫폼 기능 모듈(`mod_*`) 추가 없음.
