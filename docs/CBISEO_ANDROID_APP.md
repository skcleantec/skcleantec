# 청소비서 Android 업무 앱 — 제품·기술 전략

> **Play 표시명:** `청소비서`  
> **패키지(applicationId):** `com.cbiseo.app`  
> **개발자 계정:** Morgan Pyo · 계정 ID `7331486328299394690` — [`GOOGLE_PLAY_CONSOLE.md`](./GOOGLE_PLAY_CONSOLE.md)

---

## 1. 한 줄 요약

| 항목 | 방향 |
|------|------|
| **이 앱** | 팀장·마케터·관리자 **업무 웹**(`/team/*`, `/admin/*`)을 **WebView 셸**로 Play 배포 |
| **업데이트** | **화면·기능 = 웹 배포만** (Railway staging → main). Play 재배포는 셸·FCM·targetSdk 등 **드묾** |
| **알림** | **FCM** (앱 종료·백그라운드) + **WebSocket `inbox:refresh`** (앱 실행 중, 기존 패턴) |
| **CRM** | **앱에 넣지 않음** — PC 전용 `/admin/crm` |
| **전화 앱** | **별도** `청소비서(마케터)` `com.cbiseo.marketer` — 통화·CallLog·dispatch (Play 심사 중) |

---

## 2. Play 앱 2개 정책 (고정)

| Play 앱 | 패키지 | 대상 | 본문 |
|---------|--------|------|------|
| **청소비서** | `com.cbiseo.app` | 팀장·마케터·관리자 업무 | **웹** `www.cbiseo.com` |
| **청소비서(마케터)** | `com.cbiseo.marketer` | 상담실 **전화·수신·dispatch** | **네이티브** (텔레CRM) |

- **skcleantec** 패키지·브랜드 노출 금지 — `.cursor/rules/no-skcleantec-branding.mdc`
- 팀장 전용 `com.cbiseo.team` **분리 앱 계획 폐기** → 통합 `com.cbiseo.app` 로 일원화

---

## 3. 아키텍처

```
┌──────────────────────────────────────────┐
│  청소비서 Android (com.cbiseo.app)        │
│  · 네이티브 로그인 (업체코드+아이디)         │
│  · WebView → https://www.cbiseo.com/…    │
│  · JWT → localStorage (sk_*_token) 주입   │
│  · CbiseoApp JS 브릿지 (FCM·플랫폼 감지)   │
│  · FirebaseMessagingService (FCM)         │
└────────────────┬─────────────────────────┘
                 │ HTTPS  /api/*  /ws?token=
                 ▼
┌──────────────────────────────────────────┐
│  Railway API (기존)                       │
│  · POST /api/push/staff-app/register     │
│  · notifyInboxRefresh → FCM fan-out       │
└──────────────────────────────────────────┘
```

### 3.1 웹 셸 — 역할 라우팅

로그인 성공 후 **`GET /api/auth/me`** 로 role 확인 (기존 `LoginPage`와 동일 규칙):

| role | WebView 시작 URL | localStorage |
|------|------------------|--------------|
| `TEAM_LEADER`, `EXTERNAL_PARTNER` | `/team/dashboard` | `sk_team_token` |
| `ADMIN`, `MARKETER` | `/admin/dashboard` | `sk_admin_token` + `sk_team_token` |
| 기타 | 로그인 거부 안내 | — |

- **URL·쿼리 유지:** `.cursor/rules/routing-url-persistence.mdc` — WebView 내 네비게이션은 SPA 그대로
- **CRM 차단:** `/admin/crm`, `/admin/crm/soomgo` — 앱에서 PC 전용 안내 (`shared/cbiseoStaffAppPolicy.ts`)

### 3.2 업데이트 모델

| 변경 종류 | 배포 경로 | Play 심사 |
|-----------|-----------|-----------|
| UI·업무 로직·API | **웹만** | 불필요 |
| FCM payload·딥링크 규약 | 서버 + (필요 시) 셸 | 드묾 |
| targetSdk·권한·WebView 보안 | **AAB 재업로드** | 필요 |
| Firebase 프로젝트·google-services | 셸 재빌드 | 필요 |

---

## 4. 알림 (FCM + WS)

### 4.1 트리거 (1차)

`notifyInboxRefresh` 호출부(배정·접수 PATCH·C/S·메시지·정보공유 등 **30+**)에서 **동일 userId**에 FCM fan-out.

| 우선순위 | 이벤트 | 푸시 문구 (예) |
|----------|--------|----------------|
| P0 | 신규·재배정 | 「○○님 접수가 배정되었습니다」 |
| P0 | 1:1 메시지 | 「새 메시지가 있습니다」 |
| P1 | C/S 신규·상태 | 「C/S 접수가 갱신되었습니다」 |
| P1 | 정보공유 인계 | 「DB가 인계되었습니다」 |
| P2 | 해피콜·스케줄 알림 | cron/기존 스케줄 알림 연동 |

- **포그라운드:** WS `inbox:refresh` → 페이지 silent refetch (`.cursor/rules/team-realtime-websocket.mdc`)
- **백그라운드:** FCM data/notification → 탭 시 deep link (`/team/assignments`, `/admin/messages` 등)

### 4.2 DB · API

- 모델: `StaffAppFcmToken` (`tenantId`, `userId`, `token`, `appId=com.cbiseo.app`)
- `POST /api/push/staff-app/register` — 로그인·FCM 토큰 갱신
- `DELETE /api/push/staff-app/register` — 로그아웃
- env: `FIREBASE_SERVICE_ACCOUNT_JSON` (또는 경로) — **미설정 시 WS만**, 등록 API는 동작

### 4.3 레거시 Web Push

- `TeamLeaderWebPushSubscription` + `WEBPUSH_VAPID_*` — **사용 안 함**. FCM으로 대체.

---

## 5. 구현 로드맵

| Phase | 내용 | 상태 |
|-------|------|------|
| **0** | 정책·문서·`shared` 정책 상수 | ✅ |
| **1** | `apps/cbiseo-android` WebView 셸 + 로그인 + JS 브릿지 | ✅ |
| **1b** | 클라이언트 `isCbiseoStaffNativeApp` + CRM PC 전용 차단 | ✅ |
| **2** | FCM 토큰 register API + `StaffAppFcmToken` 마이그레이션 | ✅ |
| **3** | Firebase Admin 발송 + Android FCM SDK (코드) | ✅ — **Console·Railway 설정 필요** |
| **4** | Play 내부 테스트 · 스토어 등록 | [`FIREBASE_SETUP.md`](../apps/cbiseo-android/docs/FIREBASE_SETUP.md) |
| **5** | 푸시 딥링크·문구 세분화 | 예정 |

---

## 6. 코드 위치

| 영역 | 경로 |
|------|------|
| Android 셸 | `apps/cbiseo-android/` |
| **Firebase·FCM 설정** | [`apps/cbiseo-android/docs/FIREBASE_SETUP.md`](../apps/cbiseo-android/docs/FIREBASE_SETUP.md) |
| Play 가이드 | `apps/cbiseo-android/docs/GOOGLE_PLAY_CBISEO.md` |
| 정책 상수 | `shared/cbiseoStaffAppPolicy.ts` |
| 클라이언트 감지 | `client/src/utils/cbiseoNativeApp.ts` |
| 서버 push | `server/src/modules/push/staffAppPush.*` |
| 에이전트 규칙 | `.cursor/rules/cbiseo-android-app.mdc` |
| 전화 앱 (별도) | `apps/telecrm-android/` · `docs/TELECRM_ANDROID_APP.md` |

---

## 7. 체크리스트 (신규 기능)

1. 팀장/스태ff 화면 데이터 변경 시 `notifyInboxRefresh` + (Phase 3+) FCM 대상 userId 명시?
2. 앱 WebView에서 `/admin/crm` 진입 차단?
3. 멀티테넌트: FCM 등록·발송 모두 `tenantId` 스코프?
4. Play 심사 계정·비밀번호는 Console에만 — git 금지
