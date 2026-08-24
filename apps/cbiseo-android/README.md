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
3. Play AAB: `scripts/create-release-keystore.ps1` → `init-keystore-properties.ps1` → `build-play-bundle.ps1` (터미널만 — `.cursor/rules/cbiseo-android-play-terminal.mdc`)

### Windows — Studio Run 시 `Unable to delete directory ... build` 

**Windows는 빌드 출력을 `%LOCALAPPDATA%\CbiseoAndroidBuild\app` 으로 보냅니다** (repo `app/build` 잠금 회피).

1. **Android Studio 완전 종료**
2. `.\scripts\clean-for-studio-run.ps1`
3. Studio 재실행 → **Sync Project with Gradle Files** → **업무폰만** 선택 → Run
4. 재발 시 Windows Defender **제외**: `%LOCALAPPDATA%\CbiseoAndroidBuild`, `.gradle`

USB 실기기: `scripts/install-via-adb.ps1` (`-BuildFirst`는 Studio 닫은 뒤)

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
