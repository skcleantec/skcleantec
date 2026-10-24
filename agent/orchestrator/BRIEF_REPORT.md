# BRIEF — 1인 사업자 모드 (Phase 0–2)

상태: `feat/solo-operator`를 `staging`에만 올린다. `main` 푸시 없음. Phase 3 대기. migrate 없음.

## 한 일

- 1인 작업만 `origin/staging` 기준 브랜치로 분리. 정보공유 인계·Android 파일 5개는 원래 작업 트리에 그대로 둠.
- 판별 `isSoloOperatorTenant`, 담당 `resolveFieldOwnerIds`, 메뉴 `getModuleVisibility`.
- 해피콜·일정 알림이 1인 사장에게 감. 사장이 직접 고친 변경은 1인 업체에서만 그 사람 푸시에서 뺌.
- 1인 관리자 가계부 `/admin/my-ledger` (팀장 화면 재사용). 월정산표·팀장 가계부는 그 업체 메뉴에서 뺌.

## 확인

- server·client tsc 통과.
- 수정 파일 diff는 파일 전체 재작성이 아님 (약 363줄 추가 / 119줄 삭제, 새 파일 별도).
- 스키마 변경 없음, tenantId 누락 없음.
- 본사(배정 ON)는 `affectedTeamLeaderIds`가 있으면 수신자 목록을 그대로 씀.

## 주의

- `canReceiveHappyCallPush`에 ADMIN을 넣음. 1인 해피콜 FCM이 필터에 막히던 것을 통과시키기 위함. 본사 수신자 목록은 팀장 분기 그대로.
- `.gitattributes`의 `* text=auto eol=lf`는 아직 없음. 추가는 승인 전.
