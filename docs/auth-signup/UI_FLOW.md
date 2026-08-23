# ADMIN SNS 가입 — UI 흐름

> **페이지**: `client/src/pages/TenantSignupPage.tsx` (`/signup`)  
> **디자인**: [UI_DESIGN_GUIDE.md](../UI_DESIGN_GUIDE.md) §5 로그인·§4 공개 폼 · `.cursor/rules/mobile-keyboard-input-visibility.mdc`

---

## 1. 위저드 개요

| 단계 | 제목 | Phase |
|------|------|-------|
| **0** | (선택) SNS 인증 | 4~5 |
| **1** | 업체·관리자 정보 | 2+ |
| **2** | 이메일 인증·약관·플랜 | 기존 |
| **3** | **사업자 구분** | **2** |
| **4** | 완료 → `/login?tenant=` | 기존 |

**진행 규칙**

- 단계 indicator (1/4) — 모바일 컴팩트
- **뒤로** 가능, **complete 전** 임시 state는 sessionStorage optional
- URL: `/signup?step=business` 등 쿼리 반영 권장 — `.cursor/rules/routing-url-persistence.mdc`

---

## 2. 단계 0 — SNS (Phase 4+)

**표시**

```
[ Google로 시작 ]  [ 카카오로 시작 ]
──────── 또는 ────────
이메일·비밀번호로 가입
```

**동작**

1. OAuth 팝업/redirect
2. 서버 verify → `signupToken` + providerSub 보관 (sessionStorage)
3. **단계 1**으로 — 비밀번호 필드 숨김

**문구**

- 「업체 최고 관리자(ADMIN) 계정만 SNS로 개설할 수 있습니다.」

---

## 3. 단계 1 — 업체·관리자

| 필드 | UI | 검증 |
|------|-----|------|
| 업체 코드 | slug input + 중복 확인 | 기존 |
| 업체명 | | 기존 |
| **관리자 실명** | label **실명** 강조 | 빈값·「관리자」only 거부 |
| 로그인 아이디 | `@` 불가 안내 | `tenantLoginId` |
| 비밀번호 / 확인 | SNS 시 **hidden** | 비밀번호 가입만 |
| 연락처 | | 기존 |

**브랜드**: `TenantBrandLogo` — 로그인과 동일 톤.

---

## 4. 단계 2 — 이메일·약관·플랜

기존 `TenantSignupPage` 유지:

- 담당 이메일 + 인증번호 발송/확인
- 회원사 이용약관·개인정보 (`LegalDocumentViewerModal`)
- 플랜 카드 (`TENANT_SELF_SIGNUP_PLAN_IDS`)
- 추천인 코드 (선택)

**안내**

- 「SNS에 등록된 이메일과 다를 수 있습니다. **본인 확인용 이메일**을 인증해 주세요.」

---

## 5. 단계 3 — 사업자 구분 (Phase 2 핵심)

### 5.1 선택 UI

**세그먼트 또는 라디오 (필수)**

| 값 | 라벨 |
|----|------|
| `registered_business` | **사업자입니다** |
| `individual` | **사업자가 아닙니다** (개인·프리랜서 등) |

### 5.2 `registered_business` 폼 (선택 시 펼침)

| 필드 | 컴포넌트 |
|------|----------|
| 사업자등록번호 | input + 형식 힌트 (000-00-00000) |
| 상호 | input (기본: 업체명과 동일 체크밴드) |
| 대표자명 | input (기본: 관리자 실명) |
| 사업장 주소 | input (선택) |
| 사업자등록증 | **이미지 업로드** — `ImageThumbLightbox` 미리보기 |

업로드 UX: 타업체 온보딩·`AdminInspectionPanel` 파일 제한과 동일 (jpg/png, 8MB).

### 5.3 `individual` 폼

| 필드 | 컴포넌트 |
|------|----------|
| 확인 체크 | 「사업자등록 없이 청소비서를 이용합니다. 입력 정보는 약관에 따라 처리됩니다.」 |
| 이용 형태 | select optional: 개인 / 프리랜서 / 기타 |

### 5.4 하단 CTA

- Primary: **「가입 완료」** → `completeTenantSignup` (모든 단계 payload)
- 로딩·에러 — 기존 패턴

---

## 6. 완료 화면

기존: `/login?tenant={slug}&signup=1` 리다이렉트 + 토스트

---

## 7. LoginPage (Phase 6)

**ADMIN SNS 로그인** — `/login` 하단 또는 업체 코드 아래:

```
[ Google ] [ 카카오 ]  ← 업체 코드 입력 후 활성
```

- 팀장·마케터: 버튼 **숨김** 또는 disabled + 툴팁 「관리자가 발급한 아이디로 로그인」

---

## 8. 접근성·모바일

- `useLoginScrollSurface` + `onFocusCapture` — 전 단계
- 버튼 hover/focus/disabled — `.cursor/rules/client-ui-tailwind.mdc`
- Primary CTA: `bg-slate-900`

---

## 9. 플랫폼 UI (Phase 8)

**`/platform/tenants/:id`** 상세 탭 또는 섹션:

- 사업자 구분 badge
- 번호·상호·대표자·증빙 링크
- 비사업자: `individualConfirmedAt`

---

## 10. 체크리스트 (Phase 2 UI 완료)

1. [ ] 사업자 선택 없이 complete 버튼 disabled
2. [ ] 사업자 분기 필드 표/카드 대응 (모바일 컴팩트)
3. [ ] 증빙 업로드 실패 시 메시지
4. [ ] 새로고침 시 step URL 유지 (가능 범위)
5. [ ] `lg` 미만 한 화면 스크롤·키보드 가림 없음
