# 관리자 화면 도움말 에이전트 가이드

> **용도:** 서비스접수·발주서·견적서 등 **관리자(마케터) 업무 화면** 옆 `?` 도움말 모달을 새로 만들거나 고칠 때, 사용자가 반복 요청한 기준을 한곳에 모아 둔 문서입니다.  
> **팀장 `/help` markdown** 은 `agent/product/HELP_GUIDE_TEAM.md` · `.cursor/rules/help-content-tone.mdc` 를 따릅니다. **본 문서는 앱 내 `?` 모달 전용**입니다.

---

## 1. 무엇을 만드는가

| 항목 | 규칙 |
|------|------|
| 진입 | 해당 화면 **제목 옆 `?` 버튼** → **전체 도움말 모달** (짧은 `HelpTooltip` 한 줄만으로 끝내지 않음) |
| 대상 | 비개발자(마케터·관리자). **API·컴포넌트·state·UUID** 등 코딩 용어 금지 |
| 문체 | 화면에 보이는 **버튼·탭·라벨 글자 그대로** — 「저장」「메시지 복사」「영업 브랜드」 |
| 목표 | **수정 방법**, **용어(치환코드 등) 설명**, **주의할 점**을 표·흐름도·실제 UI mock 으로 전달 |

---

## 2. 파일·폴더 구조 (복사 기준)

```
client/src/components/admin/{기능}-help/
  {Feature}HelpTrigger.tsx      # ? 버튼
  {Feature}HelpModal.tsx        # createPortal 모달 + 탭
  {Feature}HelpPreview.tsx      # InquiryHelpZoomableFigure 래퍼
  {Feature}HelpEditorLivePreview.tsx  # (필요 시) 실제 편집 컴포넌트
  {feature}HelpShared.ts        # 탭 id·개요 문구·캡션
  {feature}HelpActions.tsx      # HelpActionTable 행 (sample + meaning)
  {feature}HelpUiParts.tsx      # 실제 className 과 동일한 버튼·칩 mock
  {feature}HelpDemoData.ts      # 데모 데이터 (실명·SK 브랜드 노출 금지)
```

**페이지 연결:** `{Page}.tsx` 에 `HelpOpen` state + `Trigger` + `Modal`. 기존 `HelpTooltip` 은 **제거**하고 모달로 대체.

**참고 구현**

| 화면 | 폴더 |
|------|------|
| 서비스접수 | `inquiry-help/` |
| 스케줄 | `schedule-help/` |
| 발주서 발급 | `order-issue-help/` |
| 견적서 | `quotation-help/` |
| 고객링크설정 | `customer-link-help/` |

---

## 3. 모달 UI (필수)

- **`createPortal(..., document.body)`**, **`z-[620]`** (중첩 시 `z-[680]` lightbox)
- **`useModalScrollKeyboardAvoidance`** + 스크롤 영역 `modal-form-scroll-surface` + **`onFocusCapture`**
- **Esc** 닫기, 바깥 클릭 닫기, **`ModalCloseButton`**
- 탭: `inline-flex` 세그먼트, 모바일 `text-fluid-2xs`, 선택 `bg-slate-900 text-white`
- 본문 섹션: `rounded-xl border border-slate-200 bg-white p-3 sm:p-4`
- Primary CTA mock·버튼: **`bg-slate-900`** (프로젝트 관리 화면 규칙)

---

## 4. 설명 표 패턴 (`HelpActionTable`)

**왼쪽 = 실제 UI mock**, **오른쪽 = 설명**. 가능하면 **`{feature}HelpUiParts.tsx`** 에서 **실제 페이지와 같은 Tailwind class** 를 재사용.

```tsx
// 행 타입
{ sample: <CustomerLinkHelpSaveButton />, meaning: '…', when?: '화면 하단' }
```

- `when` (선택): 보라색 작은 글씨 「표시: …」
- 버튼 mock: `disabled`, `tabIndex={-1}`, `aria-hidden`, `pointer-events-none`

---

## 5. 화면 미리보기 — **실제 UI** (가장 중요)

사용자가 반복 강조한 요구:

> **단순 박스 mock(「업체명 · 사업자번호」 같은 축약 그림) 금지.**  
> **실제 편집 화면과 같은 컴ponent** 또는 **실제 스크린샷**을 쓴다.

### 우선순위

1. **실컴ponent + 데모 데이터** (권장, 유지보수 좋음)  
   - 예: `QuotationDocumentEditor`, `CustomerLinkMessagePreviewEditor`  
   - 래퍼: `pointer-events-none select-none`  
   - 데모: `quotationHelpDemoData.ts` — `이○○`, `010-****-1234`, 브랜드 **청소비서** (SK/실명 금지)

2. **스크린샷** (`client/public/help/screenshots/`)  
   - 스케줄·접수 목록 등 정적 캡처가 필요할 때  
   - `InquiryHelpZoomableFigure` 의 `zoomImageSrc` + 「크게 보기」

### Figure 래퍼

```tsx
<InquiryHelpZoomableFigure
  caption="실제 ○○ 화면과 동일합니다. 「크게 보기」로 확대할 수 있습니다."
  contentClassName="p-0 bg-transparent border-0 shadow-none"
  zoomContent={<PreviewInner enlarged />}
>
  <PreviewInner />
</InquiryHelpZoomableFigure>
```

---

## 6. 탭 구성 가이드

화면마다 다르지만, 사용자가 자주 원하는 **우선 탭**:

| 화면 유형 | 권장 1번 탭 | 자주 넣을 탭 |
|-----------|-------------|--------------|
| 발송·메시지 | **편집 방법** / **고객 발송** | 치환코드, 주의할 점 |
| 편집기(견적·발주) | **작성** 또는 **발송** (요청에 따름) | 연결, PDF, 흐름도 |
| 설정(고객링크) | **① 편집 방법** | **② 치환코드**, **③ 주의할 점** |

- 모달 열릴 때 **기본 탭** = 사용자가 가장 먼저 알아야 할 탭  
- 탭 라벨: **① ② ③** 번호 + 짧은 한글 (예: 「② 치환코드」)

---

## 7. 치환코드·설정 화면 — 반드시 넣을 내용

**고객링크설정** 등 템플릿 편집 화면:

1. **치환코드가 뭔지** — `{{date}}` 처럼 **발급·복사 시 자동으로 바뀌는 값**; 라벨(「청소일시:」)은 **일반 글자**로 직접 수정  
2. **각 코드 표** — 코드 | 의미 | 채워지는 값 | 통째 치환 여부  
   - 단일 소스: `shared/orderFormCustomerLinkPlaceholders.ts`  
3. **권장 vs 비권장**  
   - ✅ `실제청소일시: {{date}} ({{timeSlot}})`  
   - ⚠️ `{{scheduleLine}}` — 문장 통째, 라벨 수정 어려움  
4. **주의할 점**  
   - 저장 후 **새로 발급·복사하는 메시지부터** 반영 (이미 보낸 문자는 안 바뀜)  
   - 브랜드별 설정 (`영업 브랜드` 선택)  
   - 값 없으면 빈 줄 정리 (`finalizeCustomerLinkMessage`)  
   - 페이백 토큰 없으면 페이백 블록 제거 등 **실제 코드 동작**을 사용자 말로 설명  

---

## 8. 데모·브랜딩

- **`.cursor/rules/no-skcleantec-branding.mdc`** — UI mock·예시 문구에 SK클린텍/SKCleantec 노출 금지  
- 고객명 **이○○**, 전화 **010-****-1234**, 주소 **○○**  
- URL 예시: `https://www.cbiseo.com/...`

---

## 9. 작업 체크리스트 (PR·완료 전)

- [ ] 소스 Read 후 **화면 글자와 mock·설명 일치** 확인 (추측 금지)  
- [ ] 미리보기가 **실컴ponent 또는 스크린샷**인가 (축약 mock 아님)  
- [ ] `HelpActionTable` 왼열 **실제 버튼 스타일**  
- [ ] `InquiryHelpZoomableFigure` + 「크게 보기」  
- [ ] 모달 `z-[620]` · 키보드 회피 · Esc  
- [ ] `cd client` → **`npx tsc -b --noEmit`**  
- [ ] Git 커밋/푸시는 **사용자 요청 시에만**

---

## 10. `/help` markdown 과의 관계

- 앱 내 `?` 모달과 **별도**로, 긴 설명은 `scripts/help-content/` · `docs/HELP_CONTENT_GUIDE.md` 에 둘 수 있음  
- 모달은 **현장에서 바로 보는 요약·표·실UI** 에 집중  
- 팀장 가이드 HTML/MD 동기화는 `CLAUDE.md` · `agent/product/` 워크플로 참고

---

## 11. 변경 이력 (요청에서 뽑은 패턴)

| 요청 | 반영 |
|------|------|
| 접수 상세 도움말 — 실제 UI (하늘색 예약일, YmdSelect mock) | `InquiryHelpDetailSectionPreview` |
| 발주서 발급 — ? + 5탭, ① 전체 흐름 기본 | `order-issue-help/` |
| 견적서 — ? + 4탭, ① 고객 발송 기본, **실제 QuotationDocumentEditor** | `quotation-help/` |
| 「실제 모양 캡쳐」— 단순 mock 거부 | LivePreview + Figure |
| 고객링크설정 — 치환코드·수정법·주의 | `customer-link-help/` + 본 문서 §7 |

---

*새 메뉴 도움말 추가 시: 위 구조 복사 → 소스 Read → 탭·표·실UI 채우기 → tsc → 사용자에게 확인.*
