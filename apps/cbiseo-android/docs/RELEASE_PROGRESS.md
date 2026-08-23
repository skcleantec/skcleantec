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
| **Play 내부 테스트** | 미업로드 — [`FIREBASE_SETUP.md`](./FIREBASE_SETUP.md) |
| **FCM 발송** | 코드 ✅ · Firebase Console·Railway **설정 대기** |
| **WebView 셸** | Phase 1 ✅ |

---

## 버전 로그

### v1.0.0 (versionCode 1) — 2026-08-23

| 항목 | 내용 |
|------|------|
| **범위** | 프로젝트 스캐폴드 — WebView 셸·네이티브 로그인·정책 문서 |
| **서버** | `StaffAppFcmToken` · `POST/DELETE /api/push/staff-app/register` |
| **웹** | `isCbiseoStaffNativeApp` · CRM PC 전용 차단 |
| **Play** | Console 앱 생성 **대기** |
| **TODO** | Firebase · FCM 발송 · Play 내부 테스트 AAB |

---

## 에이전트 — 기록 의무

`.cursor/rules/cbiseo-android-app.mdc` — version bump·AAB·Play 업로드 시 **본 파일 최상단 표·로그 갱신**.
