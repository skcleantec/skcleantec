# 도움말 콘텐츠 작성 가이드

> **대상:** `/help` 화면·`scripts/help-content/`·`scripts/build-help-data.mjs`  
> **독자:** 청소비서를 쓰는 **관리자·마케터·팀장** (개발자 아님)

---

## 1. 목표

- 사용자가 **「이거 어떻게 하지?」** 라고 물어보지 않도록, **화면에 보이는 그대로** 설명한다.
- 버튼·탭·메뉴 이름은 **앱 UI와 동일한 글자**를 쓴다.
- 개발·인프라 용어는 **쓰지 않는다**.

---

## 2. 문체·표현 (필수)

### 2.1 버튼·메뉴·탭

- 섹션 제목·본문 모두 **「○○」 버튼**, **「○○」 탭**, **상단 「서비스접수」 메뉴** 형식을 쓴다.
- ❌ `일정 마감` (제목만) → ✅ **「일정마감」 버튼** / **「일정마감」 버튼 사용법**
- ❌ `발급` → ✅ **「발주서 발급」** 메뉴, **「노출 업체 지정 · 게시하기」** 버튼

### 2.2 쓰지 말 것 (금지 예)

| 금지 | 대신 |
|------|------|
| GNB | **상단 메뉴**, **「서비스접수」 메뉴 옆 숫자** |
| WebSocket, `inbox:refresh`, 무음 재조회 | **새로고침(F5) 없이** 목록·달력이 **자동으로** 갱신 |
| FAB | **화면 아래 「발주서」 둥근 버튼** (모바일) |
| UUID, `openInquiry`, `inquiryId`, URL 쿼리 | **다른 화면에서 「스케줄로 보기」**, **접수에서 「견적 작성」** |
| pin, createdAt, KST | **목록 맨 위 고정**, **접수일**, **오늘**, **작업 전날** |
| TO, 슬롯 TO | **남은 배정 자리**, **오전·오후 숫자** |
| acknowledge | **확인** 처리 |
| 클래스명·컴포넌트명 (`ScheduleInquiryDetailModal` 등) | **접수 상세**, **목록** |
| Tailwind 색 이름 (`amber`, `sky`) | **노란색**, **파란색**, **보라색** |

### 2.3 톤

- **합니다/하세요** 체. 짧은 문장, 표·단계 목록 활용.
- **권장 순서**(워크플로) → **화면 구성** → **자주 묻는 질문** 순을 기본으로 한다.
- FAQ는 실제로 전화·카톡으로 오는 질문 위주.

---

## 3. 구조·파일

| 경로 | 역할 |
|------|------|
| `scripts/help-content/*.mjs` | 메뉴별 상세 markdown (`buildXxxMarkdown()` export) |
| `scripts/help-content/registry.mjs` | `path` → markdown 함수 매핑 |
| `scripts/build-help-data.mjs` | `ADMIN_PAGES` 목록·요약·`data.json` 생성 |
| `client/public/help/data.json` | `/help` 가 읽는 데이터 (직접 수정하지 말고 빌드) |
| `client/public/help/screenshots/` | 스크린샷 (없으면 본문만 표시) |

**작업 순서**

1. 해당 화면 **UI 코드**에서 버튼·탭·상태 라벨 확인  
2. `scripts/help-content/` 에 markdown 추가·수정  
3. `registry.mjs` · `build-help-data.mjs` 의 `path`·`hint` 동기화  
4. `node scripts/build-help-data.mjs` 실행  

**메뉴 작성 순서 (관리자 GNB 기준)**

1. 서비스접수 하위 → 2. 스케줄 → 3. 정보공유 → 4. 관리자 전용 → 5. 광고비 → 6. 메시지 → 7. 팀장

---

## 4. markdown 본문 템플릿

```markdown
## 화면 소개
(한두 문장 + 스크린샷 있으면 1장)

---

## ○○ 탭 / ○○ 버튼 (화면에 보이는 이름)

| 화면에 보이는 이름 | 하는 일 |
|-------------------|---------|

---

## 사용 순서 (권장)

1. **「○○」** 메뉴로 이동
2. **「○○」** 버튼 클릭
3. …

---

## 자주 묻는 질문

**Q: …**

A: …
```

---

## 5. 버튼·아이콘 — `{{ui:…}}` (자동 동기화, 권장)

PNG 스크린샷은 UI가 바뀌면 **수동으로 다시 찍어야** 합니다. **버튼·탭·뱃지·아이콘**은 아래처럼 **실제 React 컴포넌트**를 embed 하면 앱 UI 변경 시 **도움말도 자동으로** 같이 바뀝니다.

### 문법

| 형식 | 예 |
|------|-----|
| 인라인 | `{{ui:schedule-btn-close}}` 을 누릅니다. |
| 표 셀 | `\| {{ui:db-btn-buy}} \| 구매 신청 \|` |
| 단독 블록(한 줄) | `{{ui:db-tabs}}` |

### 토큰 목록

- 정의: `shared/helpUiTokens.ts` + 렌더: `client/src/components/help/ui/helpUiRegistry.tsx`
- **실제 화면과 같은 컴ponent**를 쓰도록 `scheduleUiParts.tsx`, `marketplaceUiParts.tsx` 등에서 **공유**합니다.
- 편집 권한 계정: `/help?category=usage&ui=gallery` → **UI 갤러리**에서 전체 미리보기

### 새 버튼·아이콘 추가 순서

1. 실제 화면에서 쓰는 버튼을 **공유 컴포넌트**로 빼거나, 기존 컴포넌트를 import
2. `shared/helpUiTokens.ts` 에 ID 추가
3. `helpUiRegistry.tsx` 에 매핑
4. markdown에 `{{ui:새-id}}` 삽입
5. `node scripts/verify-help-ui-tokens.mjs` · `node scripts/build-help-data.mjs`

### 전체 화면 캡처 (보조)

- `![설명](파일명.png)` — 레이아웃·목록 전체 설명용. `client/public/help/screenshots/`.
- 버튼 하나만 PNG로 잘라 넣지 말고 **`{{ui:…}}` 우선**.

---

## 6. 스크린샷·링크 (전체 화면)

- 본문 이미지: `![설명](파일명.png)` — `client/public/help/screenshots/` 에 있는 파일만.
- 없는 화면은 **이미지 없이** 작성 (가짜 파일명 금지).
- 내부 경로(`/admin/...`)는 사용자에게 **메뉴 이름**으로 안내. 꼭 필요할 때만 「서비스 권역 관리」 링크처럼 **화면에 보이는 링크 문구** 사용.

---

## 7. 실시간·동기화 설명 (표준 문장)

- 「다른 사람이 접수·배정을 바꾸면 **F5 없이** 목록(또는 달력)이 **저절로** 갱신됩니다.」
- 「**저장** 버튼을 누르면 팀장 화면도 **잠시 후** 같은 내용으로 맞춰집니다.」

---

## 8. 체크리스트 (마무리)

- [ ] 모든 액션이 **UI에 보이는 이름**으로 적혀 있는가?
- [ ] 개발 용어·API·코드 식별자가 **없는**가?
- [ ] `registry.mjs` · `ADMIN_PAGES` path 가 **실제 라우트**와 같은가?
- [ ] 버튼·아이콘은 **`{{ui:…}}`** 로 넣었는가? (가능한 경우)
- [ ] `node scripts/verify-help-ui-tokens.mjs` 통과했는가?

- [ ] `node scripts/build-help-data.mjs` 실행했는가?

---

## 9. 참고 구현 (톤·깊이)

| 화면 | 파일 |
|------|------|
| 스케줄 (버튼·카드 아이콘) | `scripts/help-content/admin-schedule.mjs` |
| 서비스접수 하위 | `scripts/help-content/admin-service-inquiries.mjs` |
| 정보공유 | `scripts/help-content/admin-db-marketplace.mjs` |
| 접수 목록 (상세) | `scripts/detailed-help-inquiries.mjs` |

관련 제품 규칙: `.cursor/rules/help-content-tone.mdc`
