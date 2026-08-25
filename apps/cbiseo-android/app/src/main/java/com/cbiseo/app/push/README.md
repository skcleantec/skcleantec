# Android FCM push (`com.cbiseo.app`)

> **상세 가이드(장애 원인·v21 해결·운영 지침):**  
> [`server/src/modules/push/STAFF_APP_PUSH.md`](../../../../../../../../../../server/src/modules/push/STAFF_APP_PUSH.md)

## v21+ 핵심 (요약)

- **`StaffPushRegistration`** — GPS → JWT → FCM(캐시/await) → `StaffPushApi` POST
- **`StaffPushTokenCache`** — `onNewToken`·prefetch
- **`StaffPushRegistrationStatus`** — `CbiseoApp.getPushRegisterStatus()` 폴링용
- **CustomEvent(`cbiseo:fcm-token`) 등록 경로 사용 금지**

Firebase Console·SHA: [`apps/cbiseo-android/docs/FIREBASE_SETUP.md`](../../../../docs/FIREBASE_SETUP.md)
