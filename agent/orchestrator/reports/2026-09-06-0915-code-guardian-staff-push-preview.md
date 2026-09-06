# CodeGuardian — 팀장 앱 푸시 미리보기

**일시:** 2026-09-06 09:15 KST  
**범위:** FCM generic 제거 + 메시지 본문 미리보기

## 파일

- `server/src/modules/push/staffAppPushNotify.ts` — 페이로드 없는 사용자 FCM 생략
- `server/src/modules/realtime/inboxNotify.ts` — WS는 유지, FCM은 내용 있을 때만
- `shared/staffAppPush.ts` · `server/src/lib/staffAppPush.helpers.ts` — 미리보기 헬퍼
- `server/src/modules/messages/messages.routes.ts` — 1:1·팀전송·현장공지
- `shared/notificationPolicy.ts` · `server/src/lib/notificationPolicy.helpers.ts`
- `client/src/pages/admin/AdminNotificationPolicyPage.tsx`

## 룰

- 멀티테넌트: 메시지 조회 `tenantId` 유지
- 팀 실시간: `notifyInboxRefresh` WS 유지
- generic 폴백 재도입 금지

## 검증

- `client` `npx tsc -b --noEmit` 통과
- `server` `npx tsc --noEmit` 통과

## 소견

- BLOCKER/HIGH 없음
- 읽음 처리·상세 열기·추가금 등 화면 맞춤은 폰 알림 없음 (의도)
