# CodeGuardian — 팀장 발주서 프로필

## Files
- `inquiryIntakeFormProfile.service.ts` — `attachIntakeFormProfiles` (양식 1회 로드)
- `team.routes.ts` — 목록·상세·스케줄·PATCH 응답에 프로필
- `shared/inquiryIntakeDisplay.ts` + `teamInquiryIntakeDisplay.ts`
- 페이지는 표시만. `pages/*.tsx`에 신규 100줄 JSX 없음

## Rules
- tenantId로 양식 로드
- share REVOKED 경로 미변경
- 팀장 실시간: 기존 GET 재조회에 프로필 포함

## Verify
- server `tsc --noEmit` 통과
- worktree client `tsc --noEmit -p tsconfig.app.json` 통과
