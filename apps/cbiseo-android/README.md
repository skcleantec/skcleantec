# 청소비서 Android — 업무 WebView 앱

> **Play 표시명:** `청소비서` · **패키지:** `com.cbiseo.app`  
> **전략:** [`docs/CBISEO_ANDROID_APP.md`](../../docs/CBISEO_ANDROID_APP.md)

## 개요

- **본문:** `www.cbiseo.com` 웹 (`/team/*`, `/admin/*`) — **UI 변경은 웹 배포만**
- **CRM `/admin/crm`:** 앱에서 PC 전용 안내
- **전화 앱:** 별도 [`../telecrm-android/`](../telecrm-android/) (`com.cbiseo.marketer`)

## 빌드

1. `local.properties.example` → `local.properties` (sdk.dir)
2. Android Studio → `apps/cbiseo-android` → Run ▶
3. Play AAB: `scripts/build-play-bundle.ps1`

## Phase

| Phase | 내용 |
|-------|------|
| 1 | WebView 셸 + 로그인 + CRM 차단 (웹) |
| 2 | FCM register API + DB |
| 3 | Firebase Admin 발송 + Play 내부 테스트 |
| 4 | 푸시 딥링크·채널 |

## Play

- [`docs/GOOGLE_PLAY_CBISEO.md`](docs/GOOGLE_PLAY_CBISEO.md)
- [`docs/RELEASE_PROGRESS.md`](docs/RELEASE_PROGRESS.md)
- 개발자 계정: [`docs/GOOGLE_PLAY_CONSOLE.md`](../../docs/GOOGLE_PLAY_CONSOLE.md)
