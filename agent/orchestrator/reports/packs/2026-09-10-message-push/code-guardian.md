# 코드 점검 — 메시지 앱 알림

## 본 파일
- `staffAppPushNotify.ts` — `sound: default`
- `StaffPushNotificationHelper.kt` — 채널 HIGH+소리, 기존 채널 재생성
- `CbiseoFirebaseMessagingService.kt` — 앱 켜져 있어도 트레이+소리
- `messages.routes.ts` — 발송 경로는 이미 `notifyMessageInboxRefresh`

## 룰
- FCM 쿼리 `tenantId`+`userId` 유지
- 보낸 사람은 페이로드 없음 (화면만 갱신)

## 결과
- 서버 tsc 예정
- 소리 안정화는 **Play 앱 재설치(네이티브)** + Railway(서버 sound) 둘 다 필요
