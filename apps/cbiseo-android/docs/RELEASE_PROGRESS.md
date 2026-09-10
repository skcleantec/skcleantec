# 청소비서 Android — 버전별 진행 기록

> **패키지:** `com.cbiseo.app` · **표시명:** `청소비서`  
> **Play 가이드:** [`GOOGLE_PLAY_CBISEO.md`](./GOOGLE_PLAY_CBISEO.md)  
> **전략:** [`docs/CBISEO_ANDROID_APP.md`](../../../docs/CBISEO_ANDROID_APP.md)  
> **Gradle:** `app/build.gradle.kts`

---

## 현재 상태 (최종 갱신: 2026-09-10)

| 항목 | 값 |
|------|-----|
| **최신 versionCode** | 39 |
| **targetSdk** | **36** (Play 2026-08-31 정책 대응) |
| **최신 versionName** | `1.0.0` |
| **Play 프로덕션** | Play에 **39 업로드됨** → 다음은 **40** |
| **인앱 업데이트 매니페스트** | `latestVersionCode` **39** 권장 · `minVersionCode` **31** |
| **Play 경고** | **v39 대시보드 권장 4건** (2026-09-10) → 아래 「다음 AAB (40)」·표 · `.cursor/rules/play-console-quality.mdc` |
| **최신 AAB** | `dist/cbiseo-play-1.0.0-39.aab` |
| **AAB SHA256** | `A8ABF36BA0259061739A175CED438634E4ADA8ECE87F74D9C0A76AFDEC2173B4` |

---

## 다음 AAB (40) — Play v39 대시보드 반영 (필수)

> **캡처:** 2026-09-10 Play Console 프로덕션 · Chrome OS / Android XR / 폴더블 · 「최신 Android와 호환되지 않음」 배너 + 권장 4개.  
> **에이전트:** `versionCode`를 40으로 올리기 **전에** 이 표와 `.cursor/rules/play-console-quality.mdc` §2.4~§4를 코드에 반영한다.

| # | Play 문구 | 분류 | 40에서 할 일 |
|---|-----------|------|----------------|
| 1 | 더 넓은 화면이 표시되지 않을 수 있음 · `enableEdgeToEdge()` | 사용자 환경 | 유지. `CbiseoEdgeToEdge` / `StaffWindowInsets`의 **`setDecorFitsSystemWindows` 4곳 삭제** |
| 2 | 지원 중단 API: `setStatusBarColor` · `setNavigationBarColor` · cutout SHORT_EDGES · **`WindowCompat.setDecorFitsSystemWindows`** · **`ComponentActivity.setRequestedOrientation`** | 사용자 환경 | 우리 소스 검색 0건. 테마에 바 색 넣지 않음 |
| 3 | 인셋: `WindowInsetsCompat.Builder` · `Insets.none` · `CONSUMED` · `WindowInsets.Builder` | 사용자 환경 | 리스너는 패딩만 적용하고 **`insets` return**. CONSUMED/Builder로 인셋 비우기 금지 |
| 4 | R8 · AGP · App Bundle 크기(권장 16MB / **현재 4.4MB**) | 메모리 | AGP 8.7.3+ · minify/shrink 유지. 크기 이미 충족 — 불필요 확대 금지 |

40 빌드·업로드 후 이 절을 **「완료」**로 바꾸고, 새 「다음 AAB」는 그때 대시보드 기준으로 다시 적는다.

---

## Play 권장 조치 (출시마다 추가)

> 에이전트: 새 권장은 이 표 + `.cursor/rules/play-console-quality.mdc` 에 남긴다. 같은 유형을 다음 AAB에 재발시키지 않는다.

| 버전 | Play 문구 | 분류 | 조치 |
|------|-----------|------|------|
| 32 | 앱 최적화 기준점 미만 · 난독화 1% | 앱 최적화 · 기한 2027-02 | release `minify`+`shrink` (v34+) |
| 36 | 더 넓은 화면이 표시되지 않을 수 있음 · `enableEdgeToEdge()` 권장 | 사용자 환경 | **코드는 v25부터 적용됨.** v36 대시보드에 남는 것은 Play가 올린 AAB를 다시 본 것 |
| 36 | `setStatusBarColor` · `setNavigationBarColor` · `LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES` | 사용자 환경 | 우리 코드/테마에는 없음. Material·GMS·`enableEdgeToEdge` 내부 호출(오탐) |
| 36 | AGP 8.0+ 로 빌드 최적화 | 메모리 사용량 | **이미 AGP 8.7.3.** 내리지 말 것 |
| 39 | 더 넓은 화면 · `enableEdgeToEdge()` (Chrome OS / XR / 폴더블) | 사용자 환경 | 코드는 기존 유지. **40에서 `setDecorFitsSystemWindows` 삭제** |
| 39 | 지원 중단 API + `setDecorFitsSystemWindows` + `setRequestedOrientation` | 사용자 환경 | 우리 앱이 `setDecorFitsSystemWindows`를 `enableEdgeToEdge` 뒤에 중복 호출 중 → **40에서 삭제** |
| 39 | 인셋 API (`CONSUMED` · `Builder` · `Insets.none`) | 사용자 환경 | 리스너는 이미 `insets` return. **40에서 CONSUMED/Builder 금지 유지** |
| 39 | App Bundle 크기 권장 16MB / 현재 4.4MB · R8/AGP | 메모리 | **이미 충족.** minify 끄지 말 것 |

---

## 버전 로그

### v1.0.0 (versionCode 39) — 2026-09-10

| 항목 | 내용 |
|------|------|
| **범위** | 메시지·배정 알림: 앱이 켜져 있어도 트레이+기본 소리. 채널 HIGH 재생성. 서버 FCM `sound: default` |
| **Play** | 38 다음 번호. **업로드 후 대시보드 권장 4건** → 위 「다음 AAB (40)」 |
| **AAB** | `dist/cbiseo-play-1.0.0-39.aab` · SHA256 `A8ABF36BA0259061739A175CED438634E4ADA8ECE87F74D9C0A76AFDEC2173B4` |

### v1.0.0 (versionCode 38) — 2026-09-09

| 항목 | 내용 |
|------|------|
| **범위** | **37 위** 필수. 길안내 네이티브 `openNavi` (카카오내비·TMAP). 넓은 화면·R8은 37 유지 |
| **Play** | 이미 올린 37보다 낮은 36은 콘솔이 거부함 |
| **AAB** | `dist/cbiseo-play-1.0.0-38.aab` · SHA256 `39d1bcd1bdcfd3c176b7e01da8eecad05495f98fd936e2202189aec6491f8331` |

### v1.0.0 (versionCode 37) — 2026-09-09

| 항목 | 내용 |
|------|------|
| **범위** | Play 넓은 화면: `resizeableActivity` · `supports-screens` · `configChanges`. R8 `fullMode` |
| **Play 권장** | v36 대시보드 대응. edge-to-edge·AGP 8.7.3은 기존 유지 |
| **AAB** | `dist/cbiseo-play-1.0.0-37.aab` · SHA256 `78efe8f6d7f9331b8c61c38b9d14facf719aa42ed0fe3d403bb733bc5a35e717` |

### v1.0.0 (versionCode 36) — 2026-09-09

| 항목 | 내용 |
|------|------|
| **범위** | v35와 동일 (R8 + 길안내). 프로덕션 재제출용 versionCode만 올림 |
| **Play 권장** | 넓은 화면 2건 + R8 1건 (위 표). 매니페스트·R8 수정은 **다음 versionCode** |
| **AAB** | `dist/cbiseo-play-1.0.0-36.aab` · SHA256 `298368be476a0d546b34c2ee697105cc366adc7b1d6493af637fa2ebc9d6218b` |

### v1.0.0 (versionCode 35) — 2026-09-08

| 항목 | 내용 |
|------|------|
| **범위** | v34와 동일 (R8 + 길안내). Play 재업로드용 versionCode만 올림 |
| **AAB** | `dist/cbiseo-play-1.0.0-35.aab` · SHA256 `6da73615b688eb906748326c427310bfad0d8bde98bd352e6387e5e04f6108c2` |

### v1.0.0 (versionCode 34) — 2026-09-08

| 항목 | 내용 |
|------|------|
| **범위** | Play **앱 최적화** — R8 난독화·축소 (`minify` + `shrinkResources`) · 길안내 WebView 유지 |
| **Play** | 난독화 1%(v32) 대응. AAB ~7.8MB → ~4.6MB |
| **AAB** | `dist/cbiseo-play-1.0.0-34.aab` · SHA256 `6875863bb2eca7cca271e084ab876d7d1f8f84af4b90676641ebc4574b629dc5` |

### v1.0.0 (versionCode 33) — 2026-09-08

| 항목 | 내용 |
|------|------|
| **범위** | WebView **카카오내비·TMAP·`intent:`** 외부 실행 (팀장 접수 상세 길안내) |
| **웹** | 접수 상세 「길안내」 → 카카오내비 / TMAP · Railway `main`/`staging` |
| **AAB** | `dist/cbiseo-play-1.0.0-33.aab` · SHA256 `2cc38ae35cb8bd00768af2849ec1fb8a8fa5b9d5487227a6699a0d7678482141` |

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
