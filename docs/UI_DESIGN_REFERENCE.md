# UI 디자인 참고 — 로그인 스타일 기준

업무 화면을 **통일감 있게** 만들 때 참고용 문서입니다.  
1차 구현 기준은 **`client/src/pages/LoginPage.tsx`** (SK클린텍 통합 로그인)입니다.

프로젝트 전체 규칙은 `.cursor/rules/responsive-ui.mdc`, `project-standards.mdc`와 함께 맞춥니다.  
여기서는 **색·타이포·컴포넌트 톤**만 압축 정리합니다.

---

## 1. 원칙

- **심플·가독성**: 흰색/슬레이트 계열, 불필요한 장식·과한 애니메이션 지양.
- **일관된 둥근 모서리**: 작은 요소 `rounded-xl`, 큰 패널 `rounded-2xl`.
- **포커스 가시성**: `focus-visible:ring-2` + `ring-offset` (키보드 사용자).
- **반응형**: `text-fluid-*`, 작은 화면 `px-4`·`py-10`, 넓은 화면에서만 여백·제목 크기 확대 (`sm:`).
- **접근성**: 폼은 `label` + `htmlFor`/`id`, 알림은 `role="alert"` / `role="status"`, 장식용 영역은 `aria-hidden`.

---

## 2. 팔레트 (Tailwind)

| 용도 | 클래스 예시 |
|------|-------------|
| 페이지 배경 | `bg-slate-100` |
| 본문 텍스트 | `text-slate-900` |
| 보조 텍스트 | `text-slate-500`, `text-slate-600` |
| 테두리·구분 | `border-slate-200`, `ring-slate-900/5` |
| 비활성·트랙 | `bg-slate-300` |
| 주요 액션(브랜드 블루) | `bg-blue-600`, 호버 `hover:bg-blue-700` |
| 포커스 링 | `focus-visible:ring-blue-500` |
| 경고(세션 만료 등) | `amber-50`, `amber-200`, `amber-600`, `amber-950` |
| 오류 | `red-50`, `red-200`, `red-800` |

배경 **장식**은 로그인과 같이 **아주 약한 방사형 그라데이션**만 사용 (블루·슬레이트 틴트).  
메인 업무 테이블 화면에서는 배경을 단색으로 두고, 카드만 동일 톤을 써도 됩니다.

---

## 3. 타이포그래피

`client/tailwind.config.js`의 **fluid** 스케일을 우선 사용합니다.

| 역할 | 클래스 |
|------|--------|
| 브랜드/라벨(소) | `text-fluid-xs`, 필요 시 `uppercase tracking-[0.2em]` |
| 페이지 제목 | `text-fluid-lg font-semibold tracking-tight`, 큰 화면 `sm:text-2xl` |
| 본문·입력 값 | `text-fluid-sm` |
| 캡션·보조 한 줄 | `text-fluid-2xs leading-relaxed` |
| 푸터·메타 | `text-fluid-2xs text-slate-400` |

---

## 4. 레이아웃 — 인증·단일 카드 화면

- 전체: `min-h-screen`, 내용 수직 중앙 `flex items-center justify-center`.
- 컨텐츠 폭: `w-full max-w-[420px]` 전후 (로그인 기준).
- 바깥 여백: `px-4 py-10 sm:py-14`.
- **제목 블록은 카드 밖**에 두면 시선이 정리됩니다 (`mb-8 sm:mb-10`).

---

## 5. 글래스 카드(메인 패널)

로그인 카드 패턴:

```text
rounded-2xl border border-white/60 bg-white/90 p-6 shadow-xl shadow-slate-900/10
ring-1 ring-slate-900/5 backdrop-blur-sm sm:p-8
```

- 업무 페이지의 **모달·설정 패널**에도 같은 톤을 줄 수 있습니다(배경 블러는 선택).

---

## 6. 폼 필드

**라벨**

```text
block text-fluid-xs font-medium text-slate-600
```

라벨과 입력 사이: `space-y-1.5`.

**텍스트 입력 (공통 문자열로 재사용 권장)**

```text
w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5
text-fluid-sm text-slate-900 placeholder:text-slate-400
shadow-inner shadow-slate-900/5 transition-colors
focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-blue-500/15
```

폼 세로 간격: `space-y-5`.

---

## 7. 주요 버튼(Primary)

```text
w-full rounded-xl bg-blue-600 py-3 text-fluid-sm font-semibold text-white
shadow-lg shadow-blue-600/25 transition
hover:bg-blue-700 hover:shadow-blue-600/35
focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2
disabled:pointer-events-none disabled:opacity-50
```

로딩 시: 스피너(`animate-spin`) + 문구 `…` (말줄임표 통일).

---

## 8. 인라인 알림

**경고(만료·주의)** — 아이콘 + 텍스트, `role="status"`:

```text
flex gap-3 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3.5 py-3
text-fluid-sm text-amber-950
```

**오류** — `role="alert"`:

```text
rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-fluid-sm text-red-800
```

---

## 9. 토글 스위치 (`role="switch"`)

- 트랙: `h-7 w-11 rounded-full`, 끔 `bg-slate-300`, 켬 `bg-blue-600`.
- 썸: `h-5 w-5 rounded-full bg-white shadow-md`, 세로 중앙 `top-1/2 -translate-y-1/2`, 켤 때 `translate-x-5`.
- `aria-checked`와 상태 연동, `focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2`.

옵션을 **한 블록**으로 묶을 때:  
`rounded-xl border border-slate-200/90 bg-slate-50/50 px-4 py-3.5`, 텍스트는 `min-w-0 flex-1`로 줄바꿈 허용.

---

## 10. 배경 장식 (선택)

로그인에서 사용한 이중 방사형 그라데이션은 **풀스크린 단독 페이지**에만 쓰고,  
`pointer-events-none` + `aria-hidden`으로 클릭·스크린리더에서 제외합니다.

---

## 11. 체크리스트 (새 화면 적용 시)

1. 색이 위 팔레트에서 벗어나지 않는가? (특히 회색 단계)
2. `text-fluid-*`를 썼는가?
3. 입력·버튼의 `rounded-xl` / 카드의 `rounded-2xl`이 맞는가?
4. `focus-visible` 링이 보이는가?
5. 모바일에서 `px-4`, `min-w-0`로 줄바꿈·가로 넘침이 없는가?

---

## 12. 참고 파일

| 파일 | 설명 |
|------|------|
| `client/src/pages/LoginPage.tsx` | 본 문서의 시각적 기준 구현 |
| `client/tailwind.config.js` | `fluid` 타이포 정의 |
| `.cursor/rules/responsive-ui.mdc` | 표·목록·스크롤 등 업무 화면 규칙 |

문서를 고칠 때는 **실제 코드와 어긋나지 않게** `LoginPage.tsx`의 클래스 문자열을 기준으로 동기화하는 것을 권장합니다.
