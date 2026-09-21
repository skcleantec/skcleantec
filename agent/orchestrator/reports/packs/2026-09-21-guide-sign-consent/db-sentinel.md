# DbSentinel — 안내 서명 이미지

## Legal watch
서명은 동의 증빙·생체에 가까운 그림. 접수 스냅샷과 같은 보관. 변호사 검토 대상은 아님(기존 검수·전자계약과 동일 부류).

## Isolation
- 업로드 경로 `cbiseo/orderforms/{orderFormId}/guide-sign`
- 제출은 token으로 해당 발주서만. id-only mutate 없음.
- 로그에 PNG/본문 없음 (`[orderform-guide-sign]` 메시지만).

## Migration
없음. `consents.guideTerms.signatureUrl` JSON 필드.

## Action
- 임시저장에 그림 금지 (반영).
- 기존 제출분(서명 없음)은 보기만 가능. 신규 제출만 서명 필수.
