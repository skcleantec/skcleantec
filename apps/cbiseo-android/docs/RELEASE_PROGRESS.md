# 청소비서 Android — 버전별 진행 기록

> **패키지:** `com.cbiseo.app` · **표시명:** `청소비서`  
> **Play 가이드:** [`GOOGLE_PLAY_CBISEO.md`](./GOOGLE_PLAY_CBISEO.md)  
> **전략:** [`docs/CBISEO_ANDROID_APP.md`](../../../docs/CBISEO_ANDROID_APP.md)  
> **Gradle:** `app/build.gradle.kts`

---

## 현재 상태 (최종 갱신: 2026-08-24)

| 항목 | 값 |
|------|-----|
| **최신 versionCode** | 8 |
| **최신 versionName** | `1.0.0` |
| **Play 내부 테스트** | **진행 중** — pyo/pyo2 스테이징 · 배정·일정·금액·취소 FCM |
| **FCM 발송** | 코드 ✅ · Firebase Console·Railway **설정 대기** |
| **WebView 셸** | Phase 1 ✅ |
| **Google 로그인** | 앱 WebView GSI ❌ → **네이티브 Sign-In** ✅ (Phase 8) |
| **카카오 로그인** | WebView redirect ✅ |

---

## 버전 로그

### v1.0.0 (versionCode 8) — 2026-08-24

| 항목 | 내용 |
|------|------|
| **범위** | 취소·보류 시 담당 팀장 알림 누락 수정(서버) · 로그인 직후 FCM 토큰 등록 |
| **AAB** | `dist/cbiseo-play-1.0.0-8.aab` |

### v1.0.0 (versionCode 7) — 2026-08-24

| 항목 | 내용 |
|------|------|
| **범위** | 배정·취소 PATCH FCM · 일정·금액·취소 변경 알림(푸시+팀장 팝업) · FCM 토큰 재등록 · 포그라운드 알림 배너 |
| **AAB** | `dist/cbiseo-play-1.0.0-7.aab` |

### v1.0.0 (versionCode 6) — 2026-08-24

| 항목 | 내용 |
|------|------|
| **범위** | 팀장 최초 정보 입력 모달 — Galaxy 하단 내비게이션 바 safe area · 저장 버튼 스크롤 영역 이동 |
| **AAB** | `dist/cbiseo-play-1.0.0-6.aab` |

### v1.0.0 (versionCode 5) — 2026-08-24

| 항목 | 내용 |
|------|------|
| **범위** | pyo/pyo2 테스트 계정 **운영·스테이징** 선택 UI · React 로그인 폼 감지 수정 · 푸시 Phase 2 |
| **AAB** | `dist/cbiseo-play-1.0.0-5.aab` |

### v1.0.0 (versionCode 4) — 2026-08-24

| 항목 | 내용 |
|------|------|
| **범위** | 알림 Phase 2 · FCM 유형별 payload · 해피콜 cron 연동 |
| **AAB** | `dist/cbiseo-play-1.0.0-4.aab` |

---

## 버전 로그 (이전)

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
