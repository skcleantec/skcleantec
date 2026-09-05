# CodeGuardian — 메시지 읽음 + WebSocket

**일시:** 2026-09-05 11:50 KST

## 파일

- `server/src/modules/messages/messages.routes.ts`
- `client/src/pages/admin/AdminMessagesPage.tsx`
- `client/src/pages/team/TeamMessagesPage.tsx`
- `client/src/index.css`
- 관련: `inboxNotify.ts`, `useInboxRealtime.ts`, `useMessageThreadPoll.ts`

## 룰

- 멀티테넌트: `updateMany` / `findMany` 에 `tenantId` 유지
- 팀 실시간: 읽음 처리 후 `notifyInboxRefresh` (새로 읽힌 행이 있을 때만)
- 페이지 모듈화: 페이지에 기능 블록을 더 넣지 않음

## 점검

- [x] tenantId
- [x] 송신 원본을 읽음 처리하지 않음 (수신 행만 `readAt`)
- [x] WS 루프 방지: `count > 0` 일 때만 알림
- [x] `npx tsc -b --noEmit` (client) 통과
- [x] `npx tsc --noEmit` (server) 통과

## 발견

| 심각 | 내용 | 조치 |
|------|------|------|
| HIGH | `batchId` 있으면 읽음 UI 숨김 | 표시 복구 |
| HIGH | 읽음 `updateMany` 후 WS 없음 | `notifyInboxRefresh` |
| MEDIUM | 팀장 묶음은 첫 사본 `readAt`만 봄 | 한 명이라도 읽으면 읽음 |

BLOCKER 없음.
