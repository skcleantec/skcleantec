# SK클린텍 텔레CRM Android (사무실 내부용)

> **Play Store 심사 전** — 사무실 직원 sideload 테스트용. PC 마케터와 **동일 계정**으로 근무·예약 유치 일관성 유지.

## 앱 구성 (4탭)

| 탭 | 기능 |
|----|------|
| **발신** | 전화·문자 · 고객 검색 · 접수 요약 |
| **수신** | 통화 기록 → 서버 고객 정보 · 회신 |
| **업무** | 오늘 통화 건수·시간 · 솔루션 알림 배지 |
| **메시지** | PC `/admin/messages` 와 동일 1:1 대화 |

**실시간:** Foreground Service + `/ws?token=JWT` — 앱이 백그라운드·잠금 화면이어도 PC dispatch 수신. 통화는 **full-screen 알림** → 전화 앱 연결.

### 갤럭시(사무실폰) 권장 설정

1. 앱 최초 실행 시 **전체 화면 알림** 허용
2. **설정 → 배터리 → 백그라운드 사용 제한** 에서 「청소비서 전화」→ **제한 없음**
3. 상단 고정 알림 「PC 연결」이 켜져 있어야 백그라운드 수신이 안정적입니다

## 디자인

`docs/UI_DESIGN_GUIDE.md` **슬레이트 프리미엄 SaaS** + 커뮤니티 APP형 여백·카드 레이아웃.

- **로그인**: slate 히어로 + **청소비서 로고** + 겹치는 흰 카드 (`clean-secretary-logo.png`)
- **헤더**: 다크 GNB + 로고 · **탭 선택** `blue-600`
- **본문**: `#f4f6f8` 배경 · 둥근 카드 · 리스트 원형 아이콘 + chevron
- **폰트**: `sans-serif` (시스템 Noto Sans KR 계열)

## 설정·빌드

`local.properties` (선택 — 빌드 기본값):

```properties
sdk.dir=C\:\\Users\\user\\AppData\\Local\\Android\\Sdk
telecrm.apiBaseUrl=https://clean-solution-staging.up.railway.app
```

**로그인 화면에서 「운영 / 스테이징」** — **`pyo` 아이디만** 선택 가능합니다. 그 외 계정은 **항상 운영(`www.cbiseo.com`)** 에 연결됩니다.

| PC CRM 주소 | 앱 서버 | 대상 |
|-------------|---------|------|
| `www.cbiseo.com` | **운영** (자동) | 일반 계정 |
| Railway 스테이징 | **스테이징** (선택) | `pyo`만 |

Android Studio → `apps/telecrm-android` → Run ▶

## Release APK · 자동 업데이트

Play Store 없이 **설치 페이지 + GitHub Releases APK + Railway 매니페스트**로 배포합니다.

### 상담사 배포 (항상 이 방식)

**고정 설치 페이지** — 주소는 바뀌지 않으며, 매니페스트가 가리키는 **최신 APK**만 갱신됩니다.

| 환경 | 설치 페이지 |
|------|-------------|
| 운영 | `https://www.cbiseo.com/telecrm-app` |
| 스테이징 | `https://clean-solution-staging.up.railway.app/telecrm-app` (또는 스테이징 호스트 + `/telecrm-app`) |

- 상담사에게는 **위 URL만** 공유 (GitHub Releases 직링크 대신)
- PC **관리 대시보드 → 텔레CRM** 카드에 **「청소비서 전화 설치」** 버튼 동일 링크
- 페이지에서 **「청소비서 전화 설치」** 큰 버튼 1개 → APK 다운로드

### 릴리스 절차 (개발자 — 매 버전 동일)

1. `app/build.gradle.kts`에서 `versionCode` **+1**, `versionName` 갱신
2. signed release APK 빌드 → GitHub Release (`telecrm-v{versionName}`) 업로드
3. Railway Variables 갱신 (`scripts/set-railway-vars.ps1` — `DOWNLOAD_URL`, `SHA256` 등)
4. **설치 페이지 URL은 수정하지 않음** — `/telecrm-app`이 매니페스트를 읽어 최신 APK로 연결
5. 이미 v15+ 앱이 깔린 폰은 **앱 실행 시** 자동 업데이트 안내 (로그인·메인·버전 길게 누르기)

### 1) 로컬 release 빌드 (최초·수동 설치)

1. `keystore.properties.example` → `keystore.properties` 복사 후 비밀번호 입력
2. Android Studio **Build → Generate Signed Bundle / APK** → **release**
3. 상담사 폰에 APK sideload (「출처를 알 수 없는 앱」허용)

### 2) 매니페스트 (서버)

공개 URL (인증 불필요):

- 운영: `https://www.cbiseo.com/api/public/telecrm-app/manifest`
- 스테이징: `https://clean-solution-staging.up.railway.app/api/public/telecrm-app/manifest`

Railway Variables (`scripts/set-railway-vars.ps1`):

| 변수 | 설명 |
|------|------|
| `TELECRM_APP_LATEST_VERSION_CODE` | 최신 `versionCode` (정수) |
| `TELECRM_APP_LATEST_VERSION_NAME` | 표시 버전 (예 `0.6.5-internal`) |
| `TELECRM_APP_MIN_VERSION_CODE` | 이 미만이면 **필수 업데이트** |
| `TELECRM_APP_DOWNLOAD_URL` | GitHub Release APK URL |
| `TELECRM_APP_SHA256` | APK SHA256 (소문자 hex) |
| `TELECRM_APP_RELEASE_NOTES` | 업데이트 안내 (선택) |

### 3) 앱 동작

- **로그인 화면** 진입 시 매니페스트 확인 (필수·선택 업데이트)
- **메인** 화면: 24시간에 한 번 확인 · **헤더 ⟳ 버튼** 또는 **버전 탭** → 수동 확인
- 로그인 화면 **버전 길게 누르기** → 수동 확인
- 업데이트 다이얼로그 **「설치 페이지 열기」** · **「설치가 차단될 때」** (Play 프로tect·삼성 자동 차단 안내)
- 다운로드 → SHA256 검증 → 시스템 설치 화면

### 삼성·Play 프로tect 「악성 앱」 차단 시

사내 sideload APK는 스토어 미등록이라 **삼성 자동 차단·Play 프로tect**에 막힐 수 있습니다.

1. Play 스토어 → 프로필 → **Play 프로tect** → 톱니 → **Play 프로tect로 앱 검사** 끄기 (설치 직후 다시 켜도 됨)
2. **설정 → 보안 및 개인정보 → 자동 차단** → 앱 설치 검사 끄기
3. 브라우저에서 `https://www.cbiseo.com/telecrm-app` → APK 다운로드 → **내 파일** 앱으로 APK 열기 → 설치

앱 내 업데이트가 막히면 위 **설치 페이지**로 수동 설치하세요.

### 4) CI 릴리스 (선택)

GitHub Secrets: `TELECRM_KEYSTORE_BASE64`, `TELECRM_KEYSTORE_PASSWORD`, `TELECRM_KEY_ALIAS`, `TELECRM_KEY_PASSWORD`

`app/build.gradle.kts`에서 `versionCode`/`versionName` 올린 뒤 태그 `telecrm-v{versionName}` 푸시 → `.github/workflows/telecrm-android-release.yml`

## Phase 2~ (예정)

- CallLog 자동 연동·통화 시간
- FCM 백그라운드 푸시
- 웹 → 앱 SMS 큐
