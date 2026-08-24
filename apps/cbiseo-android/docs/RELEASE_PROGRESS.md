# 청소비서 Android — 버전별 진행 기록

> **패키지:** `com.cbiseo.app` · **표시명:** `청소비서`  
> **Play 가이드:** [`GOOGLE_PLAY_CBISEO.md`](./GOOGLE_PLAY_CBISEO.md)  
> **전략:** [`docs/CBISEO_ANDROID_APP.md`](../../../docs/CBISEO_ANDROID_APP.md)  
> **Gradle:** `app/build.gradle.kts`

---

## 현재 상태 (최종 갱신: 2026-08-23)

| 항목 | 값 |
|------|-----|
| **최신 versionCode** | 1 |
| **최신 versionName** | `1.0.0` |
| **Play 내부 테스트** | **진행 중** — keystore → AAB → Console 업로드 |
| **FCM 발송** | 코드 ✅ · Firebase Console·Railway **설정 대기** |
| **WebView 셸** | Phase 1 ✅ |
| **Google 로그인** | 앱 WebView GSI ❌ → **네이티브 Sign-In** ✅ (Phase 8) |
| **카카오 로그인** | WebView redirect ✅ |

---

## 버전 로그

### v1.0.0 (versionCode 1) — 2026-08-23

| 항목 | 내용 |
|------|------|
| **범위** | 프로젝트 스캐폴드 — WebView 셸·네이티브 로그인·정책 문서 |
| **서버** | `StaffAppFcmToken` · `POST/DELETE /api/push/staff-app/register` |
| **웹** | `isCbiseoStaffNativeApp` · CRM PC 전용 차단 |
| **Play** | Console 앱 생성 **대기** |
| **TODO** | keystore · `build-play-bundle.ps1` · Play **내부 테스트** 업로드 |

---

## 내부 테스트 — 지금 할 일 (순서)

| # | 작업 | 상태 |
|---|------|------|
| 1 | `.\scripts\create-release-keystore.ps1` → `keystore/cbiseo-release.jks` | ☐ |
| 2 | `.\scripts\init-keystore-properties.ps1` → `keystore.properties` | ☐ |
| 3 | `.\scripts\build-play-bundle.ps1` → `dist/cbiseo-play-1.0.0-1.aab` | ☐ |
| 4 | [Play Console](https://play.google.com/console) → `com.cbiseo.app` 앱 (없으면 생성) | ☐ |
| 5 | **앱 콘텐츠** · 스토어 등록정보 ( [`GOOGLE_PLAY_CBISEO.md`](./GOOGLE_PLAY_CBISEO.md) §5~6 ) | ☐ |
| 6 | **테스트 → 내부 테스트** → AAB 업로드 → 출시 | ☐ |
| 7 | 테스터 Gmail 추가 → 설치 링크로 실기기 검증 | ☐ |

---

## 에이전트 — 기록 의무

`.cursor/rules/cbiseo-android-app.mdc` — version bump·AAB·Play 업로드 시 **본 파일 최상단 표·로그 갱신**.
