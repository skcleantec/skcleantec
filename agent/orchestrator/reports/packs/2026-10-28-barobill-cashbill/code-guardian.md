# CodeGuardian — 이중 호출

- `callBarobillSignup` 호출은 기본 브랜드 선점 이후 1곳, 플랫폼 승인 선점 이후 1곳이다.
- 승인은 `updateMany(PENDING_REVIEW → PROCESSING)` count가 1일 때만 호출한다. 0이면 409 `이미 처리 중`.
- 기본 브랜드 재시도는 `FAILED → PROCESSING` count 1. 신규는 `PROCESSING`으로 만든 뒤 호출한다. 실패하면 `FAILED`로 되돌린다.
- 승인 실패는 `PENDING_REVIEW`로 되돌린다.
- 추가 브랜드 제출은 바로빌을 호출하지 않는다.
- `server tsc --noEmit` 0, `client tsc -b --noEmit` 0, `prisma generate` 완료. migrate 없음.
- 접수 목록·스케줄·마케터 집계 파일은 이번 수정에 없다.
