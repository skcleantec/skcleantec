# ADMIN SNS 가입 — 단계별 구현

> **순서 고정** — 앞 Phase 완료·staging 검증 전 다음 Phase 착수하지 않는다.

---

## Phase 0 — 문서화 ✅

| 작업 | 산출물 |
|------|--------|
| 정책·API·스키마·UI 정리 | `docs/auth-signup/*` |

**완료 기준**: README·POLICY·PHASES·DATA_MODEL·API·UI_FLOW 작성

---

## Phase 1 — 데이터 모델 (마이그레이션) ✅

| 작업 | 파일 |
|------|------|
| `TenantSignupBusiness` 테이블 | `server/prisma/schema.template.prisma` + `migrations/20260823140000_*` |
| `UserAuthIdentity` 테이블 | 동일 |
| `User.passwordHash` nullable | 동일 |
| `shared/authSignup.ts` enum·헬퍼 | `shared/authSignup.ts` |
| 서버 검증·create 헬퍼 | `server/src/modules/auth-signup/` |
| SNS-only 로그인 거부 메시지 | `auth.routes.ts` |

**완료 기준**

- [x] 마이그레이션 SQL 커밋
- [x] `auth-signup` 모듈 스캐폴드
- [x] `npx prisma migrate deploy` 성공 (staging DB)
- [x] `npx tsc` server 통과

**검증**: 기존 `/signup` complete·`/api/auth/login` 스모크

**다음 착수**: **Phase 2 — `/signup` UI + complete API 사업자 단계**

---

## Phase 2 — 사업자 구분 (비밀번호 가입 경로 먼저)

> SNS 없이 **기존 `/signup`에 4단계만** 추가 — OAuth보다 먼저.

| 작업 | 파일 |
|------|------|
| complete API에 `businessType`·사업자 필드 | `server/src/modules/auth-signup/` 또는 `tenantSignup.service.ts` |
| 사업자등록증 업로드 (공개 presign 또는 기존 upload) | `businessRegistration.service.ts` 재사용 |
| `TenantSignupPage` 4단계 UI | `client/src/pages/TenantSignupPage.tsx` |
| `tenantSignup.ts` API 타입 | `client/src/api/tenantSignup.ts` |

**완료 기준**

- [x] complete API·업로드·UI·`tenantSignup.ts` 구현
- [x] `npx tsc` client/server 통과
- [ ] 사업자 / 비사업자 모두 complete 성공 (staging E2E)
- [ ] `TenantSignupBusiness` 행 생성 확인
- [ ] 필수 필드 누락 시 400 확인

**검증**: staging `/signup` E2E — 두 분기 각 1회

---

## Phase 3 — 실명·이메일 정책 강화

| 작업 | 내용 |
|------|------|
| ADMIN `name` 빈값·플레이스홀더 거부 | 서버 `assertValidAdminRealName` |
| `recoveryEmail` OTP 필수 유지 | 기존 flow 유지·문구 정리 |
| 가입 complete 후 `/login?tenant=` | 기존 유지 |

**완료 기준**: 실명 미입력·「관리자」만 입력 시 거부 (정책에 맞게)

---

## Phase 4 — Google OAuth (ADMIN 가입)

| 작업 | 내용 |
|------|------|
| Google Cloud OAuth 클라이언트 | Railway Variables — [GOOGLE_SETUP.md](./GOOGLE_SETUP.md) |
| `GET/POST /api/public/auth-signup/oauth/google/*` | config + id_token verify → `signupToken` |
| complete에 `provider` + `providerSub` 저장 | `UserAuthIdentity` |
| `/signup` Google 버튼 | TenantSignupPage |
| 비밀번호 필드 SNS 시 숨김 | UI_FLOW |

**완료 기준**

- [x] 서버 verify·signupToken·complete·`UserAuthIdentity` 연동
- [x] `/signup` Google 버튼·비밀번호 숨김·OTP 유지
- [x] `GOOGLE_SETUP.md` · `.env.example`
- [ ] Railway `GOOGLE_OAUTH_CLIENT_ID` 설정 + staging E2E
- [ ] Google로 가입 → 사업자 단계 → 테넌트 생성
- [ ] 동일 Google sub 재가입 → 409
- [ ] `passwordHash` null ADMIN 로그인 불가 (Phase 6 전)

---

## Phase 5 — Kakao OAuth (ADMIN 가입)

| 작업 | 내용 |
|------|------|
| Kakao Developers 앱·REST API 키 | Railway Variables — [KAKAO_SETUP.md](./KAKAO_SETUP.md) |
| `GET/POST /api/public/auth-signup/oauth/kakao/*` | config + code exchange → `signupToken` |
| `/signup` 카카오 버튼 | `KakaoSignupButton` + redirect `/signup?code=` |
| complete · `UserAuthIdentity` | Phase 4와 동일 |

**완료 기준**

- [x] 서버 verify·signupToken·complete 연동
- [x] `/signup` 카카오 버튼·redirect 처리
- [x] `KAKAO_SETUP.md`
- [ ] Kakao Redirect URI + Railway `KAKAO_REST_API_KEY` + staging E2E
- [ ] 카카오로 가입 → 사업자 단계 → 테넌트 생성
- [ ] 동일 카카오 id 재가입 → 409

---

## Phase 6 — Google/Kakao 로그인 (기존 ADMIN)

| 작업 | 내용 |
|------|------|
| `POST /api/auth/oauth/google` `{ tenantSlug, ... }` | `auth.routes.ts` 또는 `auth-signup` |
| `POST /api/auth/oauth/kakao` | 동일 |
| `LoginPage` — 업체 코드 + SNS (ADMIN 안내) | client |
| JWT 발급 — 기존 login과 동일 payload | |

**완료 기준**

- [x] `POST /api/auth/oauth/google|kakao` · ADMIN JWT 발급
- [x] `/login` Google·카카오 버튼 (업체 코드 후)
- [ ] 가입한 ADMIN — 업체 코드 + SNS → `/admin/dashboard`
- [ ] 다른 업체 slug + 같은 SNS → 401/403
- [ ] 팀장 계정 + SNS 시도 → 거부

---

## Phase 7 — 비밀번호 fallback

| 작업 | 내용 |
|------|------|
| SNS-only ADMIN — forgot-password | `tenantPasswordReset` — recoveryEmail OTP |
| OTP 후 `passwordHash` 설정 | login dual path |

**완료 기준**: SNS-only 계정이 이메일 OTP로 비밀번호 설정 후 ID+PW 로그인 가능

---

## Phase 8 — Android · 플랫폼 · 문서

| 작업 | 내용 |
|------|------|
| Android Google Sign-In | `apps/cbiseo-android` (선택) |
| 플랫폼 테넌트 상세 — 사업자 정보 표시 | `/platform/tenants` |
| `MULTI_TENANT_PLATFORM.md` §16 self-signup 문구 정정 | obsolete 제거 |
| agent 가이드 (필요 시) | 회원가입 흐름 |

---

## Phase 의존关系

```text
Phase 0 (문서)
  → Phase 1 (DB)
    → Phase 2 (사업자 UI·API, 비밀번호 가입)
      → Phase 3 (실명 강화)
        → Phase 4 (Google)
          → Phase 5 (Kakao)
            → Phase 6 (SNS 로그인)
              → Phase 7 (비밀번호 fallback)
                → Phase 8 (Android·플랫폼)
```

**다음 착수**: **Phase 6 E2E (staging)** → Phase 7 (비밀번호 fallback)
