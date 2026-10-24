# Phase 1 — 알림을 사장에게

## CodeGuardian

- 해피콜: `core_assignments`가 켜진 업체는 기존처럼 이 분기를 타지 않는다. 꺼진 업체는 미배정 접수만 `resolveFieldOwnerIds`로 보낸다. dedupeKey는 `happy_call:${inquiryId}:hourly:${hourIndex}` 그대로.
- 일정·금액·취소: `changeLogNotify`가 배정 팀장 조회 대신 `resolveFieldOwnerIds`를 쓴다. 취소로 배정 행이 지워진 경우의 `affectedTeamLeaderIds`는 그대로라 본사 팀장 알림 대상이 늘지 않는다.
- FCM 필터 `canReceiveHappyCallPush`에 ADMIN을 넣었다. 본사 해피콜 수신자는 여전히 팀장·타업체뿐이라 횟수는 늘지 않는다. 1인 사장 페이로드가 필터에서 버려지던 것을 통과시킨다. 마케터·사무직은 그대로 제외.
- 알림 설정: 1인 ADMIN만 배정 알림을 빼고, 해피콜·일정 문구를 사장 기준으로 바꾼다. 본사 ADMIN 목록은 그대로.

## ConfigCurator

- 설정 위치: 관리 화면 알림 설정 `/admin/notification-settings`.
- 1인 업체에만 배정 토글 숨김. 도움말 문구는 응답에서만 바꾸고, 본사 공통 문구 상수는 그대로 두었다.
- 잠금 메뉴 UI는 Phase 3. 이번 단계에서는 연결하지 않음.

## RoleQA

| 경우 | 기대 | 코드 확인 |
|---|---|---|
| 본사, 배정 있음 | 그 팀장만 일정 푸시 | `resolveFieldOwnerIds`가 팀장 id만 반환 |
| 본사, 배정 없음 | 관리자 추가 없음 | 1인이 아니면 빈 배열 |
| 1인 Free, 일정 변경 | 활성 ADMIN FCM+WS | 배정 없음 → ADMIN |
| 해피콜 | 같은 시·같은 키로 한 번 | dedupeKey 형식 유지 |

브라우저로 본사·1인 계정에 푸시를 보내 보지는 않았다. 스테이징에 이 커밋이 올라간 뒤 확인한다.

## 관문

tsc 통과. 라이브 푸시 횟수는 배포 후 확인.
