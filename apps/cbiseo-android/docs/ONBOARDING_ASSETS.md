# 청소비서 Android — 스플래시·온보딩 이미지 가이드

디자이너·기획자가 **만들 파일 이름·크기·넣는 위치**만 맞추면 앱에 바로 반영됩니다.  
코드는 `SplashActivity` → (최초 1회) `OnboardingActivity` → 로그인/업무 화면 순서입니다.

---

## 1. 두 종류를 구분

| 종류 | 역할 | 노출 |
|------|------|------|
| **스플래시** | `splash_logo_center.png` 풀화면 (**2초**) | **매번** |
| **온보딩** | 3장 슬라이드 + 「시작하기」 | **최초 1회** |

---

## 2. 스플래시 — 직사각형 풀화면 1장

### 만들 것

| 항목 | 값 |
|------|-----|
| **파일명** | **`splash_logo_center.png`** |
| **권장 크기** | **1080 × 1920 px** (9:16, 직사각형 전체) |
| **형식** | PNG-24 RGB |
| **내용** | 배경·로고·캐릭터 등 **한 장에 합성** |

### 넣는 위치

```
apps/cbiseo-android/app/src/main/res/drawable-nodpi/splash_logo_center.png
```

같은 이름으로 **덮어쓰기** → **Build → Rebuild Project**

### 동작

- `SplashActivity`에서 **`splash_logo_center.png`를 fitCenter** 로 2초 표시 (늘리지 않음)
- Android 12+ **동그란 시스템 아이콘 스플래시 사용 안 함**

### 배경색

PNG 가장자리와 맞추면 전환 시 자연스럽습니다. 기본 **`#10ADFF`** (`splash_window_bg` · `onboarding_bg` 동일).

---

## 3. 온보딩 — 화면 캡처 + 설명 (권장)

실제 **앱 화면 캡처**가 잘 보이게 하려면, 슬라이드 **한 장 = 세로 PNG 한 장**으로 만드는 방식이 가장 낫습니다.

### 슬라이드 1장 크기 (Photoshop·Figma)

| 항목 | 값 |
|------|-----|
| **캔버스** | **1080 × 1920 px** (9:16, 일반 폰 세로) |
| **안전 영역** | **900 × 1200 px** — 캡처·설명 등 **중요 내용은 여기 안에만** |
| **형식** | PNG-24 RGB |
| **파일명** | `onboarding_slide_1.png` … |

### 안전 영역 좌표 (1080×1920 캔버스 기준)

| | |
|---|---|
| **가로** | 좌·우 **90px** 여백 → 안전 영역 **900px** 가운데 |
| **세로** | 위·아래 **360px** 여백 → 안전 영역 **1200px** 가운데 |
| **PS 가이드** | X **90**, Y **360**, W **900**, H **1200** |

캔버스 바깥 여백은 **`#10ADFF`** (`onboarding_bg`) 로 채우면 앱 배경과 자연스럽게 이어집니다.  
앱 하단에 **점·「다음」 버튼**이 겹치므로, 설명 글은 안전 영역 **아래쪽 200px 이내**에 두지 말고 **캡처 바로 아래~중앙** 쪽에 배치하는 편이 안전합니다.

### 레이아웃 예 (한 PNG 안에 합성)

```
┌──────────────────────────┐  1080 × 1920 (전체)
│ 90px 여백  #F8FAFC       │
│  ┌────────────────────┐  │
│  │  📱 화면 캡처       │  │  ← 안전 900×1200 안
│  │  (가로 900 꽉)      │  │     위쪽 ~900×800~900
│  ├────────────────────┤  │
│  │  제목 + 설명 2~3줄   │  │     아래 ~900×300~400
│  └────────────────────┘  │
│ 90px + 하단 360px 여백    │  (버튼·노치 대비)
└──────────────────────────┘
```

- **캡처**는 안전 영역 **가로 900px**에 맞춰 붙이기 (에뮬레이터·폰 스크린샷)
- **설명 글**은 캡처 아래, **900×1200 박스 안**에서 Photoshop으로 합성
- 앱 `strings.xml`의 `onboarding_slide_N_title` / `_body`는 **비워 두면** (현재 기본) 이미지만 크게 표시

### 넣는 위치

```
apps/cbiseo-android/app/src/main/res/drawable-nodpi/onboarding_slide_1.png
apps/cbiseo-android/app/src/main/res/drawable-nodpi/onboarding_slide_2.png
apps/cbiseo-android/app/src/main/res/drawable-nodpi/onboarding_slide_3.png
```

**`drawable/` 폴더가 아니라 `drawable-nodpi/`만** 사용 (중복·옛 이미지 방지).

1. `res/drawable/onboarding_slide_N.xml` placeholder **삭제**
2. **1080×1920** PNG 추가 → Rebuild

### 캡처 팁

- **Android Studio 에뮬레이터** 또는 **실기**에서 스크린샷 (가로 1080px 이상)
- PC 웹(`www.cbiseo.com`) 캡처도 가능 — 브라우저 폭 **390~430px** 모바일 뷰로 찍은 뒤 PS에서 **1080px**로 키우면 흐릿할 수 있음 → **가능하면 폰/에뮬레이터 캡처** 권장
- 캡처만 PNG로 export하고 설명은 `strings.xml`에 둘 수도 있음 (이미지 **1080 × 1400**, 제목·본문은 앱 UI)

---

## 3-b. 온보딩 — 일러스트만 (참고)

캡처 없이 그림만 쓸 때: **1200×1200** 정사각도 가능. 화면 캡처 설명용보다 **작게** 보입니다.

---

## 4. 슬라이드 내용 (현재 3장)

| 파일 | 주제 |
|------|------|
| `onboarding_slide_1.png` | **스케줄표** — 각 칸 표시 의미 (오전·오후=접수 가능 일정 수, 팀원=일할 수 있는 팀원, 미배정=배정되지 않은 팀장) |
| `onboarding_slide_2.png` | **도움말** — GNB·툴바의 `?` 버튼 위치, 메뉴별 도움말 안내 |
| `onboarding_slide_3.png` | **플로팅 GNB** — 버튼을 **꾹 눌러** 위·아래로 이동하는 방법 |

제목·설명은 PNG 안에 합성. `strings.xml` title/body는 비움.

---

## 5. 체크리스트 (디자인 전달 시)

- [x] 스플래시: **`splash_logo_center.png`** (`drawable-nodpi/`)
- [x] 온보딩: **1080×1920** × 3장, **900×1200** 안전 영역, `onboarding_slide_N.png`
- [ ] 풀화면 9:16 **한 장짜리 스플래시 PNG 없음**
- [ ] 슬라이드 **제목·본문은 strings.xml** (PSD 텍스트 레이어 export X)
- [ ] 브랜드: GNB 워드마크(`clean-secretary-logo`)와 앱 캐릭터 혼동 없음 — `.cursor/rules/clean-secretary-logo.mdc`

---

## 6. 확인 방법

1. 앱 **데이터 삭제** (설정 → 앱 → 청소비서 → 저장공간 → 데이터 삭제) → 온보딩 다시 표시
2. 또는 `adb shell pm clear com.cbiseo.app`
3. `./scripts/build-play-bundle.ps1` 로 AAB 빌드 후 내부 테스트

---

## 7. 관련 코드

| 파일 | 역할 |
|------|------|
| `auth/SplashActivity.kt` | 짧은 스플래시 → 온보딩/로그인 분기 |
| `auth/OnboardingActivity.kt` | 슬라이드 + 시작하기 |
| `auth/OnboardingPrefs.kt` | 최초 1회 플래그 |
| `layout/activity_splash.xml` | 스플래시 — `splash_logo_center` fitCenter |
| `layout/activity_onboarding.xml` | ViewPager + 버튼 |
