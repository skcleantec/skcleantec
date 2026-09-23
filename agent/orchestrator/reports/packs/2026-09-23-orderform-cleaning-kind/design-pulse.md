# DesignPulse — 고객 발주서 청소 종류 피커

감사 범위: `OrderFormCleaningKindPicker` · 위저드 welcome · 위저드 하단 「확인」 · 클래식 폼 상단 피커 · `shared/orderFormCleaningKind.ts` 라벨 · `docs/UI_DESIGN_GUIDE.md` §4 · `client-ui-tailwind` · `responsive-ui` · `mobile-keyboard-input-visibility`.

구현은 하지 않음. 안내 그림 문구 재작업은 HIGH이지만 5장 JPG 재생성으로 **tiny 수정이 아님**.

---

## Research notes

- 팩 README / AppScout 요약: Earth SelectCard **세로 라디오 + 그림 슬롯**. Setster식 **선택 즉시 다음 거부**. 확인은 위저드 **하단 고정**.
- 동일 팩 AppScout 전문은 없음. 위 요약을 기준으로 매핑.
- 안내 그림: `client/public/orderform/cleaning-kind/*.jpg` 5장, 각 **576×1024**.

---

## Checklist (요청 항목)

| 항목 | 결과 |
|------|------|
| 세로 카드 5개 | **통과** — `space-y-2` 전폭 카드. 가로 칩/2열 그리드 없음. |
| 확인 후 다음 | **위저드 통과** — 선택 전 하단 「확인」 `disabled`. 자동 다음 없음. **클래식은 약함** — 「확인」은 성함으로 스크롤만, 폼 진행 게이트 아님. |
| 선택 아래 그림 | **통과** — 라디오 그룹 아래 슬롯. 미선택 시 점선 안내. |
| slate 토큰 (피커) | **통과** — `slate-900/800/200/50`, CTA `bg-slate-900`. `bg-blue-600` 없음. |
| 버튼 hover / focus / disabled | **통과** — 피커 「확인」·위저드 `WIZARD_CTA_CLS` 세 상태 모두. |
| `text-fluid-*` (피커) | **통과** — 제목 `sm`, 힌트 `xs`, 캡션 `2xs`. |
| 본문 CTA `bg-blue-600` 금지 | **통과** |
| 모바일 터치 (~36–44px+) | **통과** — 카드 `py-3`+2줄 ≈ 56px+. 위저드 CTA `min-h-12`. |
| PC / 모바일 | **통과 (레이아웃)** — 공개면 `max-w-lg` 동일 세로 스택. PC 전용 표 분기 불필요. |

---

## Findings by severity

### HIGH

1. **안내 그림 한글이 읽히지 않음 (고객 대면)**  
   5장 모두 띄어쓰기·조사가 빠진 채 한 덩어리로 박혀 있다. 예: 「기준이되는청소」, 「짐이하나도없는빈집에서만가능합니다」, 「일반청소로는손도못대는현장」, 「기본청소이외에항목별로」. 카드 라벨(`입주청소` / `짐 없는 빈 집`)은 정상인데, 선택 후 핵심 안내가 깨진다.  
   일부는 의미도 어색함: 입주청소 칩 「주망고」「거실실」, 거주청소 「짐일둔채로분분만합니다」.  
   **권장:** JPG를 띄어쓰기·슬레이트 톤 문구로 다시 뽑기. 코드 패치로 고칠 일 아님.

### MEDIUM

2. **클래식 폼 「확인」은 다음을 막지 않음**  
   `showConfirm` + `classicKindConfirmed`는 힌트·성함 스크롤만. 손님은 「확인」 없이 아래로 내려 작성·제출 가능. 위저드·RoleQA(「확인을 다시 눌러야 다음」)와 결이 다름. 한 페이지 폼이라 허용 가능하나, 게이트를 맞출 거면 미확인 시 아래 필드 비활성/스크롤 잠금을 검토.

3. **잠금(disabled) 카드가 꺼진 것처럼 안 보임**  
   `disabled`는 라디오에만. `CARD_CLS`의 `disabled:*`는 `<label>`에 적용되지 않아 hover(`hover:bg-slate-50`)가 남음. 위저드는 잠기면 welcome을 건너뛰므로 주로 **클래식·발급 편집**.  
   **권장:** `disabled && 'opacity-50 pointer-events-none'`.

4. **그림이 매우 김 (576×1024, `h-auto w-full`)**  
   390px 폭에서 그림만 ≈690px. 카드 5장 아래라 안내 본문은 접힘 아래로 밀림. 위저드는 하단 「확인」이 sticky라 진행은 가능하나, 그림을 다 보기 전에 확인할 수 있음.  
   **권장:** `max-h-[min(52vh,28rem)]` + 내부 스크롤, 또는 가로형(4:3) 재작업. `object-cover`는 높이 제한이 없어 지금은 잘리지 않음.

### LOW

5. **클래식 피커 주변 신규 문구가 `text-xs` + `gray-*`**  
   「한 가지만 고르면…」「그림을 확인한 뒤…」. 피커 본체는 slate·fluid. §4 / 「레거시 gray 신규 금지」에 새 한 줄만 어긋남. `text-fluid-xs text-slate-500`이면 충분.

6. **클래식 피커 「확인」 `min-h-11`(44px) vs §4 제출 48px**  
   위저드 푸터는 `min-h-12`. 터치 최소는 충족. `min-h-12`로 맞추면 양면이 같다.

7. **카드에 `touch-manipulation` 없음** — `WizardChoiceChip`에는 있음. 더블탭 줌만 약간 유리.

8. **그림 아래 캡션이 카드 라벨·힌트와 중복** — 그림 자체에도 큰 제목이 있음. 캡션은 장식에 가깝다.

9. **발급 편집(넓은 PC)** — 피커가 부모 전폭. 공개 `max-w-lg`는 괜찮고, 인라인 편집만 가로로 길게 늘어날 수 있음. `max-w-lg` 한 겹이면 충분.

### 통과 · 참고 (이슈 아님)

- 위저드 welcome: 피커에 `showConfirm` 없음 → 확인은 푸터 「확인」. README와 일치.
- 위저드 CTA: `slate-900` / hover `800` / `focus-visible:ring` / `disabled:opacity-45`. 선택 전 `stepInvalid`로 꺼짐.
- 위저드 `useLoginScrollSurface` + `login-surface` + `onFocusCapture`. welcome은 라디오만이라 키보드 이슈 낮음. 클래식도 동일 훅 + `onFocusCapture`.
- 라벨: `입주청소` `이사청소` `준공청소` `거주청소` `특수청소`. 힌트와 역할 분리 명확.
- 새 아이콘 없음 (네이티브 라디오). `line-md` 위반 없음.
- 위저드 질문 `text-2xl`은 기존 `WizardQuestion`. 이번 피커 범위 밖.

---

## PC

- 공개 위저드·클래식 모두 `max-w-lg`. 세로 카드가 데스크톱에서도 읽기 좋음 (선택 1개 + 긴 안내 그림).
- 선택: `border-slate-900` + `ring-1` + `bg-slate-50`. 본문 CTA와 같은 슬레이트.
- 인라인 발급 편집만 카드가 과하게 넓어질 수 있음 (LOW-9).

## Mobile / WebView

- 카드 터치면·하단 CTA 높이 충족. 위저드 푸터 `safe-area-inset-bottom`.
- 그림 높이(MEDIUM-4) + 깨진 한글(HIGH-1)이 모바일에서 더 두드러짐.
- 팀 컴팩트·포털 모달은 해당 없음 (공개 고객 폼).

## App / WebView

- 별도 네이티브 UI 없음. 공개 웹뷰는 위와 동일. 키보드 훅은 클래식 이후 입력 칸에서 동작.

---

## Recommendations (후속, 이번 미구현)

1. **HIGH:** 5장 안내 JPG 한글 띄어쓰기·검수 후 교체. 푸시 전 필수에 가깝다.
2. **MEDIUM:** 잠금 카드 시각 `opacity-50`. 필요 시 그림 `max-h` + 슬롯 스크롤.
3. **LOW:** 클래식 주변 문구를 `text-fluid-xs text-slate-*`로. 피커 확인 `min-h-12`.

Suggested diff scope: 에셋 5장 + (선택) `OrderFormCleaningKindPicker.tsx` disabled 클래스 한 줄. 위저드 푸터·단계 검증은 유지.

---

## PUSH-safe

**아니오.**

피커·위저드 확인·토큰·fluid·터치·PC/모바일 레이아웃은 푸시 가능한 수준이다.  
다만 고객이 고른 뒤 보는 **안내 그림 문구가 공개 폼 품질을 깬다.** 그림 교체 전에는 staging 푸시를 권하지 않는다.

코드만 보면 **조건부 예스** (에셋을 푸시 전에 고친다는 전제).

---

## Files touched (if any)

- 없음 (감사만)
