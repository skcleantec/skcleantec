# 청소비서 업무 앱 — FCM 알림 모듈 가이드

> **범위:** Play `청소비서` (`com.cbiseo.app`) · 팀장·마케터·관리자  
> **관련:** `staffAppPush.routes.ts`, `staffAppPushNotify.ts`, Android `push/` 패키지, `client/src/utils/cbiseoNativeApp.ts`

---

## 1. 한 줄 요약

| 구분 | 역할 |
|------|------|
| **서버** | FCM 토큰 저장·발송 (`StaffAppFcmToken`, Firebase Admin) |
| **Android (Play v21+)** | FCM 토큰 발급·캐시·**네이티브** `POST /register` |
| **웹 (Railway)** | JWT 동기화·등록 상태 폴링·**웹 POST 백업** |
| **실시간(앱 켜짐)** | WebSocket `inbox:refresh` — FCM과 **별도** (`.cursor/rules/team-realtime-websocket.mdc`) |

---

## 2. 2025-08 장애 — 무엇이 문제였는가

### 2.1 증상

- 알림 설정: **「서버 등록: 미등록」**
- `GET /api/push/staff-app/status` → `fcmServerConfigured: true`, **`hasRegisteredToken: false`**
- 「서버 등록 새로고침」 후 **12초 뒤** 「FCM 토큰 또는 서버 등록 응답이 없습니다…」 (v18~v20)
- 서버·Firebase·Railway env는 정상 — **스크립트로 가짜 토큰 POST는 200 OK**

### 2.2 근본 원인 (확정)

**서버/Firebase가 아니라 Play 앱(WebView 셸)이 FCM 토큰을 DB에 넣지 못한 것.**

| 실패 요인 | 설명 |
|-----------|------|
| **CustomEvent 경로 (v20)** | 네이티브가 `evaluateJavascript`로 `cbiseo:fcm-token` 이벤트를 쏘고, 웹이 `fetch()`로 `/register` — **이벤트가 WebView에 거의 전달되지 않음** → 웹 12초 타임아웃만 반복 |
| **JWT 불일치 (v18~v19)** | 웹 `localStorage` JWT와 네이티브 `TokenStore` JWT가 어긋나면 네이티브 OkHttp POST가 「JWT 없음」으로 실패 |
| **토큰 발급 타이밍** | `FirebaseMessaging.getInstance().token` 콜백만 기다리면 Play 실기기에서 **완료 전 hang** — `onNewToken`·prefetch 캐시 없이는 빈 상태 |
| **오해하기 쉬운 점** | 「스테이징은 된다」= **다른 계정·에뮬레이터·다른 DB** 조합. 동일 계정(kds)은 스테이징·운영 모두 미등록이었음 |

### 2.3 v20까지 시도했지만 부족했던 것

- WebView JWT `captureFromWebView` 동기화
- 네이티브 FCM → 웹 POST 분리
- Toast·`cbiseo:push-register` 에러 콜백

→ **전달 계층(CustomEvent) 자체가 불안정**해서, 서버까지 도달하지 못함.

---

## 3. 해결 — v21 네이티브 우선 아키텍처 (2025-08-25)

Play **versionCode 21** + Railway 웹 배포 (`staging` / `main`).

### 3.1 설계 원칙 (Firebase Android 권장)

1. **FCM 토큰은 네이티브에서** `tasks.await()` + **로컬 캐시** (`onNewToken`, 앱 기동 prefetch)
2. **서버 등록은 네이티브 OkHttp** — `POST /api/push/staff-app/register` (WebView fetch에 의존하지 않음)
3. **JWT** — 웹이 `CbiseoApp.syncAuthToken(jwt)` 로 `TokenStore`에 **항상 동기화**
4. **상태 피드백** — CustomEvent 금지 → **`getPushRegisterStatus()` JSON 폴링**
5. **백업** — 네이티브 실패 시 캐시 토큰 + 웹 `registerStaffAppFcmToken()` 2차 시도

### 3.2 등록 시퀀스 (정상 · **사용자 조작 불필요**)

```
[앱 설치 → 로그인]
  LoginActivity → registerTokenForce(JWT)  (v22+)
  CbiseoApplication → prefetchToken → JWT 있으면 register (v22+)

[홈·팀/관리 레이아웃 — Railway 웹]
  useStaffAppNativePushRegister → ensureCbiseoStaffPushRegistered
    (status 확인 → 미등록 시 폴링 + 웹 POST 백업, 8초 후 1회 재시도)

[알림 설정 화면]
  미등록이면 진입 시 자동 ensure (버튼은 「등록 다시 시도」= 장애 시만)
```

### 3.3 코드 위치

| 계층 | 파일 |
|------|------|
| **오케스트레이터** | `apps/cbiseo-android/.../push/StaffPushRegistration.kt` |
| 토큰 캐시 | `StaffPushTokenCache.kt` |
| 등록 상태 (브릿지) | `StaffPushRegistrationStatus.kt` |
| 채널·권한 래퍼 | `StaffFcmRegistrar.kt` |
| 서버 HTTP | `StaffPushApi.kt` |
| onNewToken | `CbiseoFirebaseMessagingService.kt` |
| WebView 연동 | `StaffWebActivity.kt`, `CbiseoAppBridge.kt` |
| 웹 브릿지·폴링 | `client/src/utils/cbiseoNativeApp.ts` |
| 알림 설정 UI | `client/src/components/notifications/StaffNotificationSettingsPanel.tsx` |
| JWT sync 훅 | `client/src/hooks/useStaffAppNativePushRegister.ts` |
| API | `server/src/modules/push/staffAppPush.routes.ts` |
| 발송 | `server/src/modules/push/staffAppPushNotify.ts` |

---

## 4. 개발·운영 지침 (필수)

### 4.1 Play vs 웹 배포 구분

| 변경 | Play AAB | Railway 웹 |
|------|----------|------------|
| 알림 설정 UI·폴링·JWT sync | 불필요 (v21+) | **필요** |
| FCM 토큰 발급·네이티브 POST | **v21+ 필수** | — |
| 푸시 문구·kind·path | 서버만 | **필요** |
| Firebase SHA·google-services | **필요** | — |

### 4.2 FCM 등록 체크리스트 (신규 기능·장애 시)

1. Railway **`FIREBASE_SERVICE_ACCOUNT_JSON`** (프로젝트 `cbiseo-staff`) — staging·production
2. Firebase Console — **`com.cbiseo.app`** + Play **앱 서명 SHA-1** + 업로드 키 SHA-1
3. Play Internal Testing — **versionCode ≥ 21**
4. 앱 로그인 → 알림 설정 **「앱 빌드 21」** 표시 확인
5. 「서버 등록 새로고침」 → **구체적 메시지** (GPS / JWT / FCM / 서버) — 12초 무분별 타임아웃이면 **구버전 앱 또는 웹 미배포**
6. DB / API:

```powershell
cd apps\cbiseo-android
node scripts/probe-staff-push-status.mjs --base https://www.cbiseo.com --tenant <slug> --email <id> --password <pw>
```

`hasRegisteredToken: true` + `deviceLabel` 확인.

### 4.3 금지 (회귀 방지)

| 금지 | 이유 |
|------|------|
| FCM 등록 **CustomEvent만**으로 처리 (`cbiseo:fcm-token`, `cbiseo:push-register`) | WebView에서 이벤트 누락 — **2025-08 장애 원인** |
| 네이티브 POST 없이 **웹 fetch만** 1차 경로 | JWT·쿠키·타이밍 이슈 |
| `TokenStore` JWT 없이 register | 「로그인 JWT 없음」 |
| Web Push(VAPID) 재도입 | FCM으로 대체 완료 |
| FCM register·발송에 **`tenantId` / `userId` 누락** | 멀티테넌트 유출 — `.cursor/rules/multitenant-safety.mdc` |

### 4.4 증상별 1차 진단

| 증상 | 1차 확인 |
|------|----------|
| `fcmServerConfigured: false` | Railway env · redeploy |
| `hasRegisteredToken: false` | Play **v21+** · 알림 설정 등록 · probe |
| 등록 UI 「Google Play 서비스 필요」 | GMS 업데이트 · Play 스토어 |
| 「로그인 JWT 없음」 | 재로그인 · `syncAuthToken` 웹 배포 여부 |
| 「FCM 토큰 발급 실패」 | Firebase SHA-1 · `google-services.json` · 앱 재설치 |
| 등록 OK · 푸시만 없음 | `staffAppPushNotify` · 사용자 알림 설정(kind) · `registration-token-not-registered` 로그 |
| 앱 켜져 있을 때만 갱신 | **정상** — WS `inbox:refresh`. FCM은 백그라운드·종료용 |

### 4.5 알림 발송 (서버)

- `notifyInboxRefresh(userIds)` 호출부와 **동일 userId**에 FCM fan-out
- 규약: `shared/staffAppPush.ts` — `kind`, `title`, `body`, `path`
- data payload: `type: staff-app:navigate`
- env 미설정 시 FCM skip, **WS는 계속 동작**

### 4.6 푸시 탭 → 해당 건 이동 (딥링크)

| kind | path 예 | 화면 동작 |
|------|---------|-----------|
| `assignment` | `/team/assignments?openInquiry=<id>` | 배정 목록에서 해당 접수 상세 |
| `schedule_alert` | 동일 | 일정·금액·취소 변경 접수 상세 |
| `happy_call` | 동일 | 해피콜 대상 접수 상세 |
| `message` (관리→팀) | `/admin/messages?openUser=<senderId>&openMessage=<msgId>` | 대화 선택 후 해당 메시지 스크롤 |
| `message` (팀→관리) | `/team/messages?openMessage=<msgId>` | 해당 메시지 스크롤 |

- 접수 변경(일반 changelog)은 `schedule_alert` kind + `openInquiry` path
- 웹: `useStaffAppPushNavigation` (`cbiseo:navigate`) · 접수: `useTeamOpenInquiryDeepLink` / `AdminInquiriesPage`
- Android: `StaffWebActivity` path 로드 · 포그라운드 heads-up: `assignment`, `schedule_alert`, `happy_call`, `message`

---

## 5. API 요약

| Method | Path | 용도 |
|--------|------|------|
| GET | `/api/push/staff-app/status` | 서버 FCM 설정·본인 토큰 등록 여부 |
| POST | `/api/push/staff-app/register` | `{ token, appId: "com.cbiseo.app", deviceLabel? }` |
| DELETE | `/api/push/staff-app/register` | 로그아웃 시 토큰 삭제 |

DB: `StaffAppFcmToken` — `(tenantId, userId, token, appId, deviceLabel, updatedAt)`

---

## 6. Android JS 브릿지 (`window.CbiseoApp`)

| 메서드 | v21+ | 용도 |
|--------|------|------|
| `syncAuthToken(jwt)` | ✅ | WebView JWT → TokenStore |
| `registerPushToken()` | ✅ | 네이티브 전체 등록 시작 |
| `getPushRegisterStatus()` | ✅ | JSON `{ pending, ok, message, fcmToken }` — **폴링** |
| `getCachedFcmToken()` | ✅ | 웹 POST 백업용 |
| `getAppVersionCode()` | ✅ | Play 빌드 확인 (≥21) |
| `requestNotificationPermission()` | ✅ | POST_NOTIFICATIONS (Android 13+) |

---

## 7. 관련 문서

| 문서 | 내용 |
|------|------|
| [`apps/cbiseo-android/docs/FIREBASE_SETUP.md`](../../../apps/cbiseo-android/docs/FIREBASE_SETUP.md) | Firebase Console·SHA·Railway env |
| [`docs/CBISEO_ANDROID_APP.md`](../../../docs/CBISEO_ANDROID_APP.md) | 제품·아키텍처 전략 |
| [`.cursor/rules/cbiseo-android-app.mdc`](../../../.cursor/rules/cbiseo-android-app.mdc) | 에이전트 규칙 |
| [`.cursor/rules/team-realtime-websocket.mdc`](../../../.cursor/rules/team-realtime-websocket.mdc) | WS 실시간 (FCM과 병행) |

---

## 8. 변경 이력 (요약)

| versionCode | 요약 |
|-------------|------|
| v18 | JWT sync·registerPushToken 브릿지·probe 스크립트 |
| v19 | JWT WebView capture·에러 Toast |
| v20 | FCM 네이티브 → **CustomEvent → 웹 POST** (실기기 실패) |
| **v21** | **네이티브 오케스트레이터 + 브릿지 폴링 + 웹 백업** (2025-08-25 해결) |
| v22 | 로그인 직후 JWT 등록 + prefetch→register + **웹 `ensureCbiseoStaffPushRegistered` 자동** (버튼 불필요) |
