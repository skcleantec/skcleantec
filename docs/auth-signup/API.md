# ADMIN SNS 가입 — API

> **베이스**: 공개 `/api/public/*` · 인증 `/api/auth/*`  
> **구현 모듈 (목표)**: `server/src/modules/auth-signup/`

---

## 1. 기존 API (유지·확장)

### `GET /api/public/tenant-signup/slug-available`

변경 없음.

### `POST /api/public/tenant-signup/send-verification-code`

변경 없음 — `contactEmail` OTP.

### `POST /api/public/tenant-signup/complete` — **확장**

**기존 필드** (유지)

| 필드 | 필수 |
|------|------|
| `slug`, `name`, `adminLoginId`, `adminName`, `contactEmail`, `contactPhone` | ✅ |
| `memberTermsAgreed` | ✅ |
| `verificationCode`, `challengeId` | ✅ (이메일 OTP) |
| `selectedPlan`, `referrerCode` | 선택 |
| `adminPassword` | 비밀번호 가입 시 ✅ / SNS 가입 시 ❌ |

**신규 필드 (Phase 2+)**

| 필드 | 필수 | 설명 |
|------|------|------|
| `businessType` | ✅ | `registered_business` \| `individual` |
| `bizNumber` | 사업자 | |
| `businessName` | 사업자 | 상호 |
| `representativeName` | 사업자 | |
| `addressLine` | | |
| `businessRegistrationImageUrl` | 사업자 | |
| `businessRegistrationImagePublicId` | | Cloudinary |
| `individualConfirmed` | 비사업자 | `true` 필수 |
| `individualUsageNote` | | |

**신규 필드 (Phase 4+ SNS)**

| 필드 | 필수 | 설명 |
|------|------|------|
| `oauthProvider` | SNS 가입 | `google` \| `kakao` |
| `oauthProviderSub` | SNS 가입 | 서버에서 id_token 검증 후 확정 (클라 sub 단독 신뢰 금지) |
| `oauthIdToken` 또는 `oauthCode` | SNS 가입 | provider별 |

**응답** (기존 + 확장)

```json
{
  "tenant": { "id", "slug", "name", "plan" },
  "admin": { "id", "email", "name" },
  "loginPath": "/login?tenant=..."
}
```

**에러**

| status | code / message |
|--------|----------------|
| 400 | `INVALID_BUSINESS_TYPE`, 사업자 필드 누락, `individualConfirmed` false |
| 400 | `INVALID_REAL_NAME` |
| 409 | slug 중복, `(provider, providerSub)` 중복 |
| 429 | 동일 이메일 가입 시도 과다 (기존) |

**트랜잭션 순서**

1. 검증 (slug, OTP, 약관, business, OAuth token)
2. `Tenant` create
3. `TenantBillingProfile`, `TenantFeature`, seed
4. `User` create (passwordHash optional)
5. `TenantSignupBusiness` create
6. `UserAuthIdentity` create (SNS 시)
7. referral 등 부가

---

## 2. 신규 — OAuth 가입 보조 (Phase 4+)

### `POST /api/public/auth-signup/oauth/google/verify`

| body | 설명 |
|------|------|
| `idToken` | Google Sign-In JWT |

**응답**

```json
{
  "provider": "google",
  "providerSub": "...",
  "providerEmail": "...",  // 참고만
  "signupToken": "..."     // 짧은 TTL, complete에 첨부 (CSRF·재검증)
}
```

### `POST /api/public/auth-signup/oauth/kakao/verify`

| body | 설명 |
|------|------|
| `code` | Kakao authorization code |
| `redirectUri` | |

동일 shape 응답.

> **대안**: complete 한 번에 idToken/code 전달 — `signupToken` 패턴은 위조 방지용 권장.

---

## 3. 신규 — OAuth 로그인 (Phase 6)

### `POST /api/auth/oauth/google`

### `POST /api/auth/oauth/kakao`

| body | 필수 |
|------|------|
| `tenantSlug` | 선택 — SNS 계정으로 업체 자동 식별 (입력 시 일치 검증) |
| `idToken` / `code` | ✅ |

**처리**

1. `resolveTenantBySlug(tenantSlug)`
2. `assertTenantStaffLoginAllowed`
3. id_token/code 검증 → `providerSub`
4. `UserAuthIdentity` where `provider` + sub → **tenant·User 자동 결정** (`tenantSlug` 생략 가능)
5. (선택) `tenantSlug` 입력 시 가입 업체와 불일치하면 401
6. `role === ADMIN` (및 active) 확인
7. JWT 발급 — 기존 `POST /api/auth/login`과 **동일 payload**

**에러**

| status | 설명 |
|--------|------|
| 404 | tenant 없음 |
| 401 | SNS 미연결 / role 불가 |
| 403 | SUSPENDED·billing 차단 |

---

## 4. 사업자등록증 업로드

**Phase 2**: 기존 패턴 재사용

| 옵션 | 경로 |
|------|------|
| A | `POST /api/public/tenant-signup/upload-business-registration` (신규, multer+Cloudinary) |
| B | 관리자 온보딩과 동일 presign — `businessRegistration.service.ts` |

공개 가입이므로 **rate limit·MIME(image only)·8MB** — `profileOnboarding`과 동일.

---

## 5. 환경 변수 (Railway)

| 변수 | Phase |
|------|-------|
| `GOOGLE_OAUTH_CLIENT_ID` | 4+ |
| `GOOGLE_OAUTH_CLIENT_SECRET` | 4+ (code flow 시) |
| `KAKAO_REST_API_KEY` | 5+ |
| `KAKAO_OAUTH_CLIENT_SECRET` | 5+ (선택) |
| `AUTH_SIGNUP_OAUTH_STATE_SECRET` | 4+ |

---

## 6. 클라이언트 API 파일 (목표)

| 파일 | 역할 |
|------|------|
| `client/src/api/tenantSignup.ts` | complete 확장 |
| `client/src/api/authSignupOAuth.ts` (신규) | verify·login OAuth |
| `shared/authSignup.ts` | 타입·검증 헬퍼 |

---

## 7. Android

`POST /api/auth/login` 유지 + Phase 6 OAuth 엔드포인트 — `LoginActivity` / WebView login.

`docs/CBISEO_ANDROID_APP.md` §3.1 동일 JWT 규칙.
