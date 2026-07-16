# SK클린텍 UI 디자인 가이드 (통합)

프로젝트 **모든 UI·디자인 관련 규칙**을 한 문서에 모았습니다.  
`.cursor/rules/` 의 `responsive-ui.mdc`, `public-customer-ui-design.mdc`, `admin-list-filters-pagination.mdc`, `delete-password-and-date-presets.mdc`, `project-standards.mdc` §7 등 **디자인 내용의 상세 기준은 본 문서**를 따릅니다.

에이전트·개발자는 `client/` UI 작업 **시작 전** 해당 화면 유형 섹션을 읽고 구현합니다.

---

## 목차

1. [공통 원칙](#1-공통-원칙)
2. [화면 유형별 적용](#2-화면-유형별-적용)
3. [타이포그래피·폰트·전역 CSS](#3-타이포그래피폰트전역-css)
4. [공개 고객 페이지](#4-공개-고객-페이지)
5. [로그인·인증 화면](#5-로그인인증-화면)
6. [관리자·업무 반응형 UI](#6-관리자업무-반응형-ui)
7. [DB 목록 — 필터·페이지네이션 UI](#7-db-목록--필터페이지네이션-ui)
8. [기간 조회 프리셋 UI](#8-기간-조회-프리셋-ui)
9. [HelpTooltip](#9-helptooltip)
10. [삭제 확인 UI](#10-삭제-확인-ui)
11. [통합 체크리스트](#11-통합-체크리스트)
12. [참고 파일](#12-참고-파일)

---

## 1. 공통 원칙

> 출처: `project-standards.mdc` §7, `responsive-ui.mdc`, `client/src/index.css`

| 원칙 | 설명 |
|------|------|
| **슬레이트 프리미엄 SaaS** | 심플·간결. **slate** 계열 중심, 부드러운 그림자·둥근 모서리. 과한 장식은 지양하되 **미세한 hover/scale**은 칩·GNB 등 인터랙션에 허용 |
| **색·여백** | 배경 `slate-100`/`#f4f6f8`, 본문 카드 **흰색**, 텍스트 `slate-700`~`900`. 의미색(emerald/amber/red)은 상태·경고에만 |
| **형태** | 작은 컨트롤 `rounded-xl`, 카드·패널 `rounded-2xl`, 로그인 카드 `rounded-3xl` |
| **PC·모바일 동시** | 데스크톱만 만들고 모바일을 나중에 덧붙이지 않는다 |
| **가독성 우선** | 정렬·여백·정보 계층 > 장식 |
| **접근성** | `label` + `htmlFor`/`id`, 알림 `role="alert"` / `role="status"`, 장식 `aria-hidden` |
| **포커스** | `focus-visible:ring-2` (+ `ring-offset`). 화면별 ring 색은 §2·§4·§5·§6 참고 |
| **타이포** | `text-fluid-*` 우선 (`client/tailwind.config.js`) |
| **Flex** | 줄바꿈·축소 필요 시 부모에 **`min-w-0`** |

**금지 (공통)**

- **레거시 `gray-*` 단독 신규 화면** — 새 UI는 `slate-*` (기존 `gray` 화면은 점진 이전)
- Tailwind **존재하지 않는 단계** (`slate-350`, `slate-850` 등) — hover 테두리는 `slate-300`, 어두운 배경은 `slate-800`
- `text-fluid-*` 없이 고정 크기만 남발
- 공개 고객 CTA를 **`blue-600` 단독 Primary**로 쓰기 (내부 GNB active·토글용 blue와 역할 구분)

**점진 이전 (레거시)**

- **`OrderFormPage`** 등 일부 고객 발주서는 아직 `gray-50` — 신규 공개 폼은 §4, 대규모 개편 시 §4로 맞춘다.

---

## 2. 화면 유형별 적용

| 화면 유형 | Primary CTA | 헤더 / 배경 | 강조색 | 레퍼런스 |
|-----------|-------------|-------------|--------|----------|
| **공개 고객** (페이백, C/S) | `bg-slate-900` | `bg-slate-100` + **다크 헤더** `slate-900` | emerald/amber/red | §4, `ReviewPaybackPage.tsx` |
| **로그인·인증** | `bg-slate-900` | `#f4f6f8` + 은은한 radial | 입력 포커스 **sky-500**, 토글 on **blue-600** | §5, `LoginPage.tsx` |
| **관리자·팀·크루** | GNB active **`blue-600`** | **`theme-dark-header`** + 본문 밝은 카드 | **indigo-500** (대시보드·지표), slate 본문 | §6, `AdminLayout.tsx` |
| **DB 목록** | 세그먼트 선택 **`slate-900`** | `rounded-2xl` 흰 카드 | `ListPaginationBar` | §7 |

**역할 구분**

- **`slate-900`**: 공개·로그인 **제출(Primary)** , 관리자 **세그먼트·칩 선택**
- **`blue-600`**: 관리자/팀/크루 **GNB active**, 로그인 **스위치 on**
- **`indigo-500`**: 관리자 **차트·뱃지·로딩 스피너** (본문 강조, CTA 아님)

---

## 3. 타이포그래피·폰트·전역 CSS

### 3.1 웹폰트 (전역)

`client/src/index.css`:

```text
font-family: 'Inter', 'Noto Sans KR', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
font-size: 17px;  /* html, body */
```

Google Fonts: **Inter** + **Noto Sans KR** (`@import` in `index.css`).

### 3.2 전역 입력·버튼 (`index.css`)

**기본 입력** — **`staff-app-surface`** (관리·팀·크루 `main`) 안에서만 indigo 포커스 fallback:

```text
border-radius: 0.75rem (rounded-xl)
border-color: slate-200/80
focus: border indigo-500 + ring indigo-500/10
```

공개 고객(§4)·로그인(§5)은 **컴포넌트 className**으로 포커스 지정 — 전역 `!important` 사용하지 않음.

**스크롤바:** slate-300 thumb, 8px, pill (`index.css` 전역).

### 3.3 Fluid 스케일 (필수)

| 토큰 | 용도 |
|------|------|
| `text-fluid-2xs` | 캡션·메타·표(좁은 화면) |
| `text-fluid-xs` | 라벨·힌트·푸터 |
| `text-fluid-sm` | 본문·입력·버튼·표 본문 |
| `text-fluid-base` | 강조 본문 |
| `text-fluid-lg` / `xl` / `2xl` | 페이지·섹션 제목 |
| `calendar-2xs` / `calendar-xs` | 7열 캘린더 전용 |

**관리자 표:** `text-fluid-2xs` → 큰 화면 `xl`/`2xl` 단계 확대 가능.

### 3.4 공통 타이포 패턴

| 역할 | 클래스 |
|------|--------|
| 헤더 영문 라벨 | `text-fluid-xs uppercase tracking-wider text-slate-400` |
| 페이지/헤더 제목 | `text-xl sm:text-2xl font-semibold tracking-tight text-slate-900` |
| 카드 제목 | `text-lg font-semibold text-slate-900` |
| 필드 라벨 | `text-sm font-medium text-slate-700` 또는 `text-fluid-xs font-medium text-slate-600` |
| Step 뱃지 | `text-[10px] font-semibold uppercase tracking-wider text-slate-400` |

---

## 4. 공개 고객 페이지

> 출처: `public-customer-ui-design.mdc`  
> 기준 구현: **`client/src/pages/review-payback/ReviewPaybackPage.tsx`**

고객 링크 공개 폼·신청·접수. **슬레이트·다크 헤더·카드 폼** 톤.

### 4.1 색상·배경

| 용도 | Tailwind / 값 |
|------|----------------|
| 페이지 배경 | `bg-slate-100` (`#f1f5f9`), html/body 동기화 |
| 헤더 | `bg-slate-900 text-white` |
| 헤더 라벨/부제 | `text-slate-400`, `text-slate-300` |
| 본문 | `text-slate-900` ~ `text-slate-500` |
| 테두리 | `border-slate-100`, `border-slate-200` |
| Primary CTA | `bg-slate-900` → hover `800` |
| 성공 | `emerald-50/100/600/800` |
| 경고 | `amber-50/100/900/950` |
| 오류 | `red-50/100/800` |
| 그림자(카드) | `shadow-xl shadow-slate-300/35` |

**지양:** 풀스크린 강한 gradient, `gray-*`/`slate-*` 혼용, 플랫폼 외부명 노출.

### 4.2 PageShell 레이아웃

```text
min-h-dvh flex flex-col w-full bg-slate-100
├── header  bg-slate-900  max-w-lg mx-auto px-4 py-4 sm:py-5
└── main    flex-1 max-w-lg mx-auto px-4 py-6 sm:py-8 pb-10 min-w-0 bg-slate-100
```

- body 배경: 마운트 `#f1f5f9`, 언마운트 복원.
- 터치: `min-h-[44px]` 입력·보조 버튼, `min-h-[48px]` 제출, `touch-manipulation`.

### 4.3 컴포넌트 패턴

**Step (3단계)**

```text
grid grid-cols-3 gap-2
진행: rounded-xl border border-slate-200/80 bg-white/70 shadow-sm
대기: rounded-xl border border-dashed border-slate-200 bg-slate-50/50
```

**메인 카드**

```text
bg-white rounded-2xl shadow-xl shadow-slate-300/35 border border-slate-100 overflow-hidden
헤더: px-5 sm:px-6 pt-6 pb-4 border-b border-slate-100
경고: border-b border-amber-100/80 bg-amber-50/60
폼:   px-5 sm:px-6 py-5 space-y-6
```

**입력·셀렉트**

```text
w-full min-h-[44px] rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-fluid-sm
focus:border-slate-300 focus:outline-none focus:ring-2 focus:ring-slate-900/15
```

**Primary 제출**

```text
w-full min-h-[48px] rounded-xl bg-slate-900 py-3 text-fluid-sm font-semibold text-white
shadow-md shadow-slate-900/15 hover:bg-slate-800 disabled:opacity-45
```

**완료 화면:** `rounded-2xl` 카드 + `emerald` 원형 아이콘 + `rounded-full bg-slate-100` 상태 pill.

**로딩:** `py-20` + `animate-spin border-slate-300 border-t-slate-700`.

폼은 `<form onSubmit>` + `e.preventDefault()`. 로딩 문구 `…` 통일.

### 4.4 공개 페이지 체크리스트

1. [ ] PageShell + `bg-slate-100` 원톤
2. [ ] 다크 헤더 + `max-w-lg`
3. [ ] 카드 `rounded-2xl`, CTA `slate-900`
4. [ ] `text-fluid-*`, 터치 44px+
5. [ ] `min-w-0`, 가로 넘침 없음

---

## 5. 로그인·인증 화면

> 기준 구현: **`client/src/pages/LoginPage.tsx`**

**Primary CTA는 공개 고객과 동일하게 `slate-900`.** 입력 포커스만 **sky** 계열로 구분.

### 5.1 팔레트

| 용도 | 클래스 / 값 |
|------|-------------|
| 페이지 배경 | `bg-[#f4f6f8]` |
| 배경 장식 | radial gradient + 옅은 grid (`pointer-events-none`, `aria-hidden`) |
| 본문 | `text-slate-900` |
| 보조 | `text-slate-500`, `text-slate-600` |
| 테두리 | `border-slate-200/80`, `ring-slate-900/[0.04]` |
| Primary 제출 | `bg-slate-900`, hover `slate-800`, `shadow-lg shadow-slate-900/20` |
| 입력 포커스 | `focus:border-sky-500/80`, `focus:ring-4 focus:ring-sky-500/10` |
| 스위치 on | `bg-blue-600` (크루 모드 등) |
| 경고 / 오류 | §4와 동일 amber/red |

### 5.2 레이아웃

- `min-h-screen`, 중앙 정렬
- 폭 `max-w-[420px]`, `px-4 py-10 sm:py-14`
- 브랜드·플랫폼명 블록은 카드 **위** (`mb-7 sm:mb-8`)

### 5.3 로그인 카드

```text
rounded-3xl border border-slate-200/80 bg-white/95 p-6 sm:p-8
shadow-[0_24px_48px_-28px_rgba(15,23,42,0.28)] ring-1 ring-slate-900/[0.04] backdrop-blur-md
내부 헤더: border-b border-slate-100 pb-5 text-center
테넌트 pill: rounded-full bg-slate-100 px-3 py-1 text-fluid-2xs font-semibold text-slate-700
```

### 5.4 폼·버튼

**라벨:** `block text-fluid-xs font-medium text-slate-600`, `space-y-1.5`.

**입력 (공통 `inputClass`):**

```text
w-full rounded-xl border border-slate-200/90 bg-slate-50/60 px-3.5 py-2.5 text-fluid-sm
placeholder:text-slate-400
focus:border-sky-500/80 focus:bg-white focus:ring-4 focus:ring-sky-500/10
```

**Primary 버튼:** §5.1 Primary 제출 참고.

**토글 블록:** `rounded-xl border border-slate-200/90 bg-slate-50/50 px-4 py-3.5`

### 5.5 인라인 알림

**경고** (`role="status"`): `rounded-xl border border-amber-200/80 bg-amber-50/90 …`

**오류** (`role="alert"`): `rounded-xl border border-red-200 bg-red-50 …`

---

## 6. 관리자·업무 반응형 UI

> 출처: `responsive-ui.mdc`  
> 기준 레이아웃: **`AdminLayout.tsx`**, **`TeamLayout.tsx`**, **`CrewLayout.tsx`**

### 6.1 다크 GNB — `theme-dark-header`

관리자·팀·크루 상단 헤더 공통. **`index.css`** 의 `.theme-dark-header` + Tailwind 조합.

```text
header: relative z-20 px-4 py-2.5 shrink-0 shadow-md theme-dark-header
  배경: slate-900 (#0f172a), 테두리 slate-800
  본문 max-w-6xl mx-auto
main:   max-w-6xl mx-auto px-4 py-6 min-w-0 flex-1 overflow-y-auto staff-app-surface
```

`staff-app-surface`: 업무 화면 폼 기본 스타일(indigo focus) — `index.css` §3.2

**GNB NavLink (active / inactive):**

```text
공통: inline-flex px-3 py-1.5 text-fluid-xs font-semibold rounded-xl whitespace-nowrap
      transition-all duration-200 hover:scale-[1.015] active:scale-[0.98]
active:   bg-blue-600 text-white shadow-sm shadow-blue-900/20
inactive: text-slate-300 hover:text-white hover:bg-white/10
```

**가로 스크롤 GNB:** `overflow-x-auto`, 스크롤바 숨김, 좌우 **쉐브론** (`rounded-full border border-slate-800 bg-slate-800`).

**헤더 내 gray 텍스트 class**는 CSS override로 slate 톤으로 보정 (`theme-dark-header .text-gray-*`).

### 6.2 본문 카드·섹션 (프리미엄 SaaS)

**목록 래퍼·패널**

```text
rounded-2xl border border-slate-200/60 bg-white shadow-sm shadow-slate-100/50 overflow-hidden
```

**대시보드·집계 섹션**

```text
rounded-2xl border border-gray-200 bg-white p-5 shadow-sm shadow-gray-100/50
  (신규는 border-slate-200/60 + shadow-slate-100/50 로 통일)
섹션 헤더: border-b border-gray-100 pb-3
지표 아이콘: text-indigo-500
뱃지: rounded-full bg-indigo-50 text-indigo-700 ring-1 ring-indigo-700/10
로딩: border-b-2 border-indigo-500 animate-spin
```

**모바일 목록 카드**

```text
rounded-2xl border … shadow-md shadow-slate-100/40
hover:shadow-lg hover:scale-[1.01] transition-all duration-200
상태별: red/amber/sky 테두리 + 옅은 배경 (접수 목록 패턴)
```

**행·칩 버튼 (표/카드 액션)**

```text
rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-fluid-2xs font-semibold shadow-sm
transition-all duration-150 hover:scale-[1.03] active:scale-[0.97]
hover:bg-slate-50 hover:border-slate-300
```

### 6.3 PC·모바일 동시 설계

- **좁은 화면 (`lg:hidden`):** 카드·요약·핵심 액션
- **넓은 화면 (`hidden lg:block`):** 표·열 정렬·비교
- 목록 기본 브레이크포인트: **`lg`**
- 가로 스크롤: **`SyncHorizontalScroll`** + 모바일 안내·하단 요약

### 6.4 리스트·상세 서식

**표**

- `table-fixed` + `colgroup`, 긴 값 `truncate` + `title`
- 금액: `text-right tabular-nums` + `toLocaleString('ko-KR')` + `원`
- 주소·연락처: `inquiryListDisplay.ts` 등 공통 유틸

**상세·모달**

- 섹션 단위 `rounded-2xl` 카드, `text-fluid-*` 통일

### 6.5 Flex·테이블

- 테이블만 가장자리까지: **`-mx-4 px-4 sm:mx-0 sm:px-0`**
- 바깥 카드: **`overflow-hidden` 금지** (가로 스크롤 깨짐 방지)

### 6.6 테이블 정렬 (필수)

| 요소 | 규칙 |
|------|------|
| `th` | **항상** `text-center` |
| `td` | 기본 `text-center`, 긴 텍스트 `truncate` + `title` |
| 금액 `td` | **예외** `text-right tabular-nums` |

### 6.7 가로 스크롤 테이블

1. 페이지 루트: `min-w-0 w-full max-w-full`
2. 스크롤 래퍼: `overflow-x-auto overscroll-x-contain` + `-mx-4 px-4 sm:mx-0 sm:px-0`
3. `table`: `table-fixed` + `colgroup`, `text-fluid-2xs`
4. 첫 열 sticky: `sticky left-0 z-10` + `border-r`
5. **`SyncHorizontalScroll`**: 하단 동기 스크롤 + ◀▶

### 6.8 모바일 햄버거·플로팅 메뉴 (필수)

- **모바일(`lg` 미만)** 햄버거 드로어 트리거는 **발주서·스케줄 FAB와 같이** `fixed` 플로팅 — 목록 스크롤해도 **항상 화면에 표시**.
- 구현: **`MobileFloatingMenuButton`** (`createPortal` → `body`, `z-[118]`, 좌측·safe-area). PC는 `lg:hidden`.
- 서비스접수: Provider에서 플로팅 1개. 제목 줄 `pl-12` 로 버튼·텍스트 겹침 방지.
- 드로어: `fixed inset-0 z-[610]`.

**참고**

- `client/src/components/layout/MobileFloatingMenuButton.tsx`
- 서비스접수: `AdminInquiriesMobileSubNav.tsx`
- 스케줄 맞춤 캘린더: `ScheduleCustomCalendarMobileSheet.tsx`

---

## 7. DB 목록 — 필터·페이지네이션 UI

> 출처: `admin-list-filters-pagination.mdc`

### 7.1 표준 레이아웃

```text
[필터 줄 — rounded-2xl 카드 상/내부]
[ListPaginationBar mode="summary"]
[표 (lg+) / 카드 목록 (lg:hidden)]
[ListPaginationBar mode="nav"]
```

### 7.2 기간·조회 필터

- 기준 날짜 라벨 명시 (`접수일`, `발급일` 등)
- **세그먼트·드롭다운 선택:** `bg-slate-900 text-white font-medium` (구 `gray-800` 대체)
- **필터 컨트롤:** `rounded-lg border border-slate-200 bg-white`, hover `border-slate-300`
- **드롭다운 패널:** `rounded-xl border border-slate-200/60 shadow-xl shadow-slate-100/40`

| 화면 유형 | 권장 프리셋 |
|-----------|-------------|
| 접수·발주서·부재 보류 | `당일` · `전체` · `월별` · `날짜`/`일별` |
| C/S 등 | `3개월` · `월별` · `날짜별` |

- `월별` → **`YearMonthSelect`**, `날짜`/`일별` → **`YmdSelect`**
- 날짜: **KST**

### 7.3 페이지당 건수

- **`ListPaginationBar`** `mode="summary"` — 옵션 `[30, 50, 80, 100]`, **기본 30**

### 7.4 하단 페이지 분할

- 표 **바로 아래** `ListPaginationBar` **`mode="nav"`**

### 7.5 URL·상태

- 필터·페이지·pageSize → URL 쿼리, 프리셋 변경 시 **`page` → 1**

### 7.6 금지

- `ListPaginationBar` 미사용 커스텀 페이지 UI
- 기간 필터 없이 대량 한 번에 로드

### 7.7 목록 UI 체크리스트

1. [ ] 기간 프리셋 + 월/일 선택
2. [ ] summary + nav `ListPaginationBar`
3. [ ] PC 표 + 모바일 카드 (`lg`)
4. [ ] URL 반영
5. [ ] §6 테이블·`slate` 카드 톤
6. [ ] **편집·인라인 수정 후 스크롤 유지** (§7.8)

### 7.8 목록 편집 후 스크롤 유지 (필수)

업무용 레이아웃(`AdminLayout`·`TeamLayout`·`CrewLayout`)은 **window가 아니라** `main.staff-app-surface`가 세로 스크롤 컨테이너다. 목록에서 상태 변경·인라인 편집·저장 후 **같은 위치에서 이어서 작업**할 수 있어야 한다.

#### 원칙

| 상황 | 동작 |
|------|------|
| **초기 로드** (`items.length === 0`) | 전체 로딩占位 (`로딩 중…`) 허용 |
| **재조회·편집 후 갱신** (기존 행 있음) | 표/카드를 **갈아끼우지 않음** (stale-while-revalidate) + 스크롤 복원 |
| **필터·페이지·pageSize 변경** | `scrollStaffAppToTop()` — 맨 위부터 새 조회 결과 확인 |
| **WebSocket·폴링 silent 재조회** | `silent` / `withLoading: false` + 스크롤 복원 |

#### 공통 유틸 (복사 기준)

| 파일 | 역할 |
|------|------|
| `client/src/utils/staffAppScrollRestore.ts` | `main.staff-app-surface` scrollTop 저장·복원 |
| `client/src/utils/listRefreshDisplay.ts` | `shouldShowListBlockingLoading`, `beginListRefresh` |
| `client/src/hooks/useStaffAppScrollPreserve.ts` | React 페인트 후 스크롤 복원 훅 |

```tsx
const { preserveScroll, scrollToTop } = useStaffAppScrollPreserve();

// 재조회 시작
beginListRefresh({
  showLoading: true,
  itemCount: items.length,
  setLoading,
  preserveScroll,
});

// JSX — 기존 행이 있으면 로딩占位로 목록 전체를 교체하지 않음
{shouldShowListBlockingLoading(loading, items.length) ? (
  <div>로딩 중…</div>
) : items.length === 0 ? (
  <div>없음</div>
) : (
  <>…표/카드…</>
)}
```

편집·삭제·상태 변경 직후에는 **`load({ silent: true })`** 또는 **`refresh(false)`** 로 재조회하고, 필요 시 `preserveScroll()`을 호출한다.

#### 금지

- `setLoading(true)` 후 `{loading ? <로딩/> : <목록/>}` 로 **전체 목록 DOM을 제거**하는 패턴 (재조회·편집 후).
- 편집 후 `refresh(true)`만 호출하고 stale-while-revalidate·스크롤 복원 없이 목록을 비우는 것.

---

## 8. 기간 조회 프리셋 UI

> 출처: `delete-password-and-date-presets.mdc`

**보고·집계** 화면의 시작일·종료일 입력 **바로 옆** 드롭다운:

| 프리셋 |
|--------|
| 오늘 · 이번 달 · 지난 달 · 올해 · 지난해 · **직접 선택** |

- **`client/src/utils/dateRangePresets.ts`**
- DB 목록 세그먼트(§7)와 **역할·컴포넌트 다름** — 혼용 금지

---

## 9. HelpTooltip

> 출처: `.cursor/rules/ui-help-tooltip-rule.md`

긴 설명 대신 **`HelpTooltip`** (`client/src/components/ui/HelpTooltip.tsx`).

| 환경 | 동작 |
|------|------|
| 데스크톱 | `?` 호버 → 패널 |
| 모바일 | 탭 → 열림, 바깥·**Esc** 닫기 |

라벨 옆 배치, 본문 중복 금지.

---

## 10. 삭제 확인 UI

> 출처: `delete-password-and-date-presets.mdc`

- **비밀번호 입력 모달** 필수 (`ConfirmPasswordModal` 등)
- 시각: `rounded-2xl`, `text-fluid-sm`, **slate** 테두리·본문 (§5 오류 카드와 톤 맞춤)

---

## 11. 통합 체크리스트

### 새 화면 — 공통

1. [ ] 화면 유형(§2)에 맞는 Primary·강조색
2. [ ] `text-fluid-*`, Inter/Noto 전역 폰트
3. [ ] `rounded-xl` / `rounded-2xl` (로그인 카드 `rounded-3xl`)
4. [ ] `focus-visible` / `label`+`htmlFor`
5. [ ] `min-w-0`, PC·모바일 동시 설계
6. [ ] Tailwind 팔레트 **유효 단계만** (`slate-300` hover 등)

### 유형별 추가

| 유형 | 추가 확인 |
|------|-----------|
| 공개 고객 | §4 — PageShell, slate-900 CTA |
| 로그인 | §5 — slate-900 CTA, sky 포커스, radial 배경 |
| 관리·팀·크루 | §6 — `theme-dark-header`, blue GNB active, slate 카드 |
| 관리 목록 | §6 + §7 — lg 분기, ListPaginationBar, slate-900 세그먼트 |
| 보고·집계 | §8 — dateRangePresets |
| 도움말 | §9 — HelpTooltip |
| 삭제 | §10 — 비밀번호 모달 |

---

## 12. 참고 파일

| 파일 | 설명 |
|------|------|
| `client/src/index.css` | 폰트, 전역 입력/버튼, **`theme-dark-header`** |
| `client/src/pages/review-payback/ReviewPaybackPage.tsx` | 공개 고객 UI 기준 |
| `client/src/pages/cs/CsReportPage.tsx` | 공개 C/S (§4 맞출 것) |
| `client/src/pages/LoginPage.tsx` | 로그인·인증 기준 |
| `client/src/components/layout/AdminLayout.tsx` | 관리자 GNB·다크 헤더 |
| `client/src/components/layout/TeamLayout.tsx` | 팀장 GNB |
| `client/src/components/layout/CrewLayout.tsx` | 크루 GNB |
| `client/src/pages/admin/AdminDashboardPage.tsx` | 대시보드 카드·indigo 강조 |
| `client/src/pages/admin/AdminInquiriesPage.tsx` | 접수 목록·slate 카드 |
| `client/src/pages/admin/AdminOrderFormPage.tsx` | 발주서 목록 |
| `client/src/pages/order/OrderFormPage.tsx` | 고객 발주서 (레거시 gray — §4 이전 예정) |
| `client/src/components/ui/ListPaginationBar.tsx` | 페이지 UI |
| `client/src/utils/staffAppScrollRestore.ts` | 목록 스크롤 저장·복원 |
| `client/src/utils/listRefreshDisplay.ts` | 목록 stale-while-revalidate 헬퍼 |
| `client/src/hooks/useStaffAppScrollPreserve.ts` | 스크롤 복원 훅 |
| `client/src/components/ui/HelpTooltip.tsx` | `?` 툴팁 |
| `client/tailwind.config.js` | fluid 타이포 |

---

**동기화:** 가이드와 코드가 어긋나면 **레퍼런스 TSX의 className**을 기준으로 본 문서를 수정한다.  
룰 파일(`.mdc`)의 디자인 요약도 본 문서와 **내용이 같도록** 유지한다.
