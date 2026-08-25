# ADMIN SNS 가입 · 사업자 검증 — 확정 정책

> **Living document** — 구현·PR 설명은 본 문서와 불일치하면 안 된다. 변경 시 PHASES·API·DATA_MODEL 동시 갱신.

---

## 1. SNS 계정 범위

| 항목 | 결정 |
|------|------|
| **매핑** | **1 SNS 계정 = 1업체(tenant) 1사용자(User)** |
| **다중 업체** | 동일 Google/Kakao로 **다른 업체 가입·로그인 불가** |
| **DB** | `(provider, providerSub)` **전역 unique** |

---

## 2. SNS 가입·로그인 허용 역할

| 역할 | SNS **가입** | SNS **로그인** | 비고 |
|------|-------------|---------------|------|
| **ADMIN** (업체 최고 관리자) | ✅ 허용 | ✅ 허용 | 셀프 가입·기존 업체 모두 |
| **MARKETER** | ❌ | ✅ **연결(link) 후** | 관리자가 아이디 생성 · 프로필 **카카오 계정 연결** |
| **TEAM_LEADER** | ❌ | ✅ **연결(link) 후** | 관리자가 아이디 생성 · 프로필 **카카오 계정 연결** |
| **EXTERNAL_PARTNER** | ❌ | ✅ **연결(link) 후** | 관리자가 아이디 생성 · 프로필 **카카오 계정 연결** |
| **크루** | ❌ | ❌ | `TeamCrewGroup` 별도 |

팀장·마케터는 **관리자만 계정 생성** — 기존 `Users` 관리 흐름 유지.

---

## 3. 신규 업체 셀프 가입 (`/signup`)

| 항목 | 결정 |
|------|------|
| SNS 가입 | ✅ **허용** (ADMIN OWNER 생성) |
| 약관·개인정보 | ✅ **필수** (기존 `platformLegal` 연동) |
| **실명** | ✅ **필수** — `User.name` (로그인 아이디만으로 사람 구분 불가) |
| **이메일** | ✅ **필수 + 6자리 OTP** — `recoveryEmail` (SNS 프로필 이메일 **신뢰하지 않음**) |
| 비밀번호 | SNS 가입 시 **생략 가능** — `passwordHash` null 허용 |
| 사업자 검증 | ✅ **가입 complete 전 필수** (대시보드 진입 **전**) |

---

## 4. 사업자 검증 (가입 위저드 내)

### 4.1 시점

- **「가입 직후 필수」** = `/signup` **마지막 스텝**에서 처리
- `complete` API 성공 **전**에 `businessType` 선택 완료
- 별도 로그인 후 온보딩 화면으로 미루지 **않음**

### 4.2 선택 (필수)

| 값 | 라벨 (UI) | 의미 |
|----|-----------|------|
| `registered_business` | **사업자입니다** | 사업자등록 보유 |
| `individual` | **사업자가 아닙니다** | 개인·프리랜서 등 (사업자등록 없음) |

### 4.3 `registered_business` — 즉시 입력

| 필드 | 필수 |
|------|------|
| 사업자등록번호 | ✅ |
| 상호(사업자명) | ✅ |
| 대표자명 | ✅ (기본값: ADMIN 실명) |
| 사업자등록증 이미지 | ✅ (Cloudinary, PDF 불가 — 타업체 온보딩과 동일) |
| 사업장 주소 | 선택 |

### 4.4 `individual` — 확인만

| 필드 | 필수 |
|------|------|
| 「사업자등록 없이 이용합니다」 확인 체크 | ✅ |
| 이용 형태(개인/프리랜서 등) | 선택 |

### 4.5 서버 거부 조건

- `businessType` 없음 → 400
- `registered_business`인데 번호·상호·대표자·증빙 없음 → 400
- `individual`인데 확인 체크 없음 → 400

---

## 5. 이메일 · recoveryEmail · loginId

| 필드 | 용도 |
|------|------|
| `User.email` | **로그인 아이디** (`@` 없음 — `shared/tenantLoginId.ts`) |
| `User.name` | **실명** |
| `User.recoveryEmail` | **OTP 인증된 이메일** — 비밀번호 찾기·운영 연락 |
| SNS 프로필 이메일 | 참고 저장만, **로그인·복구에 사용 금지** |

Google/Kakao 이메일 ≠ recoveryEmail 이면 **문제 없음** — 항상 OTP로 recoveryEmail 확정.

---

## 6. 비밀번호 없는 ADMIN (SNS-only)

| 상황 | 처리 |
|------|------|
| 일상 로그인 | 업체 코드 + Google/Kakao |
| PC 비밀번호 로그인 fallback | `/forgot-password` 확장 — **recoveryEmail OTP → 새 비밀번호 설정** |
| 이후 | 업체 코드 + 아이디 + 비밀번호 **또는** SNS |

---

## 7. 멀티테넌트·보안 (필수)

- OAuth 콜백·complete 시 **`tenantId` 추측·DEFAULT 테넌트 폴백 금지** — `.cursor/rules/multitenant-safety.mdc`
- JWT 발급 시 **`tenantId` 포함** — 기존 `AuthPayload` 유지
- OAuth state CSRF 방어
- 가입 complete는 **트랜잭션** — Tenant + User + UserAuthIdentity + TenantSignupBusiness 한 번에

---

## 8. 범위 밖 (1차 → 2차 반영)

- ~~팀장·마케터 SNS **연결(link)**~~ → **2차 완료**: ADMIN·MARKETER·TEAM_LEADER·EXTERNAL_PARTNER — 프로필 **카카오 계정 연결** (`/admin/account/kakao-link`), 비밀번호 확인 후 link/unlink
- 플랫폼 `PlatformUser` SNS 로그인
- 사업자등록번호 **자동 국세청 API 검증** (2차 검토)
- 한 SNS로 **여러 업체** 전환
