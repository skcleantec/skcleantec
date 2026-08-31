# 청소비서 Android — 버전별 진행 기록

> **패키지:** `com.cbiseo.app` · **표시명:** `청소비서`  
> **Play 가이드:** [`GOOGLE_PLAY_CBISEO.md`](./GOOGLE_PLAY_CBISEO.md)  
> **전략:** [`docs/CBISEO_ANDROID_APP.md`](../../../docs/CBISEO_ANDROID_APP.md)  
> **Gradle:** `app/build.gradle.kts`

---

## 현재 상태 (최종 갱신: 2026-08-31)

| 항목 | 값 |
|------|-----|
| **최신 versionCode** | 32 |
| **targetSdk** | **36** (Play 2026-08-31 정책 대응) |
| **최신 versionName** | `1.0.0` |
| **Play 프로덕션** | v25 출시 완료 · **v32 AAB** 빌드 → Console 업로드 대기 |
| **Play 경고** | v28 edge-to-edge + v30 Material 1.14.0·테마 bar color attr 제거 |
| **최신 AAB** | `dist/cbiseo-play-1.0.0-32.aab` |
| **AAB SHA256** | `1be0d1918ebe39fb95cd302e767156d1e675b086acaa556b06736e1e596eb24d` |

---

## 버전 로그

### v1.0.0 (versionCode 32) — 2026-08-31

| 항목 | 내용 |
|------|------|
| **범위** | **Google Play In-App Update** (선택 FLEXIBLE · 필수 IMMEDIATE) + 웹 배너·프로필 「업데이트 확인」 |
| **서버** | `GET /api/public/staff-app/manifest` · Railway `STAFF_APP_*` 변수 |
| **AAB** | `dist/cbiseo-play-1.0.0-32.aab` · SHA256 `1be0d1918ebe39fb95cd302e767156d1e675b086acaa556b06736e1e596eb24d` |

### v1.0.0 (versionCode 31) — 2026-08-31

| 항목 | 내용 |
|------|------|
| **범위** | WebView **`tel:`/`mailto:`/`sms:` → 다이얼러·외부 앱 Intent** (팀장 전화 버튼 미동작 수정) |
| **웹(셸 불필요)** | 팀장 대시보드·스케줄 **KST 예약일** 그룹핑·월 범위 통일 (Railway 배포) |
| **AAB** | `dist/cbiseo-play-1.0.0-31.aab` · SHA256 `a4e4746ec53b0e1dea9504ef8822dbeba515d36e93a62a15f2212464a6295c13` |

### v1.0.0 (versionCode 30) — 2026-08-29

| 항목 | 내용 |
|------|------|
| **범위** | v26~29 누적 + **WebView 배너 캐시 무력화**(`LOAD_NO_CACHE`·앱 재개 시 배너 재조회) · Material **1.14.0** · 테마 deprecated bar color attr 제거 |
| **Play** | v25 대비 — edge-to-edge · FCM 로그아웃 정리 · 해피콜 팀장 전용 · 대시보드 홍보배너 갱신 |
| **AAB** | `dist/cbiseo-play-1.0.0-30.aab` · SHA256 `5a0772a2cfeae19352204b5849ef13302f55639d32551e20582ad8d7c1fb9098` |

### v1.0.0 (versionCode 29) — 2026-08-28

| 항목 | 내용 |
|------|------|
| **범위** | Material **1.14.0** · 테마 `statusBarColor`/`navigationBarColor` attr 제거 · activity/core bump |
| **Play** | v25 deprecated API 경고(라이브러리·테마 attr) 추가 대응 — v28 edge-to-edge 유지 |
| **AAB** | `dist/cbiseo-play-1.0.0-29.aab` · SHA256 `d897ec1608082ba61b6bbbe2e26c5b6db0c606f5008d518d605c1e84604541fc5` |

### v1.0.0 (versionCode 28) — 2026-08-28

| 항목 | 내용 |
|------|------|
| **범위** | Android 15 edge-to-edge — `enableEdgeToEdge()` · transparent system bars · WindowInsets |
| **Play** | v25 「더 넓은 화면」·`statusBarColor`/`navigationBarColor` deprecated 경고 대응 |
| **AAB** | `dist/cbiseo-play-1.0.0-28.aab` · SHA256 `023a2d4e92c733d4bd7dcce01016d6e3ae169fbe54ab98d545fc60920b7a6898` |

### v1.0.0 (versionCode 25) — 2026-08-25

| 항목 | 내용 |
|------|------|
| **범위** | **targetSdk / compileSdk 36** (Play API 정책) · WebView 외부 링크(카카오톡 채널 등) Intent 처리 |
| **AAB** | `dist/cbiseo-play-1.0.0-25.aab` |

### v1.0.0 (versionCode 24) — 2026-08-25

| 항목 | 내용 |
|------|------|
| **범위** | 스플래시 `splash_logo_center` 풀화면 · Android 12 원형 아이콘 스플래시 제거 · 온보딩 3슬라이드 · UI `#10ADFF` |
| **AAB** | `dist/cbiseo-play-1.0.0-24.aab` |

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
