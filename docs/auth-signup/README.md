# ADMIN SNS 가입 · 사업자 검증 (Auth Signup)

> **목적**: Google·카카오 간편가입 + **가입 완료 전** 사업자/비사업자 구분·실명·이메일 인증을 반영한 **ADMIN 전용** 셀프 가입.  
> **제품**: CBISEO / 청소비서 · 멀티테넌트 (`tenantId` 행 격리)

**관련**: [MULTI_TENANT_PLATFORM.md](../MULTI_TENANT_PLATFORM.md) · [UI_DESIGN_GUIDE.md](../UI_DESIGN_GUIDE.md) §5 (로그인) · `.cursor/rules/multitenant-safety.mdc`

---

## 문서 목록

| 문서 | 내용 |
|------|------|
| **[POLICY.md](./POLICY.md)** | **확정 정책** — SNS 범위, ADMIN만, 실명, 이메일 OTP, 사업자 분기 |
| **[PHASES.md](./PHASES.md)** | **단계별 구현 순서** — Phase 0~8 체크리스트 |
| **[DATA_MODEL.md](./DATA_MODEL.md)** | Prisma 스키마·마이그레이션 설계 |
| **[API.md](./API.md)** | 공개·인증 API 계약 |
| **[UI_FLOW.md](./UI_FLOW.md)** | `/signup` 위저드 화면·필드·검증 |
| **[GOOGLE_SETUP.md](./GOOGLE_SETUP.md)** | Google Cloud Console · Railway Variables · E2E |
| **[KAKAO_SETUP.md](./KAKAO_SETUP.md)** | Kakao Developers · Redirect URI · REST API 키 |

---

## 코드 배치 (목표)

| 계층 | 경로 | 비고 |
|------|------|------|
| **서버 모듈** | `server/src/modules/auth-signup/` | **신규** — OAuth·사업자 검증·complete 오케스트레이션 |
| **기존 연동** | `server/src/modules/platform/tenantSignup.service.ts` | `provisionTenantSelfServe` 재사용·확장 |
| **기존 연동** | `server/src/modules/platform/tenantSignup.public.routes.ts` | 라우트는 점진 이전 또는 위 모듈 mount |
| **기존 연동** | `server/src/modules/auth/auth.routes.ts` | OAuth **로그인**(기존 ADMIN) Phase 6 |
| **이메일 OTP** | `server/src/modules/platform/emailVerification.service.ts` | 가입·복구 공통 |
| **사업자 증빙 업로드** | `server/src/modules/onboarding/businessRegistration.service.ts` | Cloudinary 패턴 재사용 |
| **클라이언트** | `client/src/pages/TenantSignupPage.tsx` | 위저드 UI |
| **클라이언트** | `client/src/pages/LoginPage.tsx` | SNS 로그인 버튼(ADMIN, Phase 6) |
| **공유** | `shared/authSignup.ts` (예정) | businessType enum·검증 메시지 |
| **Android** | `apps/cbiseo-android/.../auth/` | Phase 7 — 동일 API |

> **원칙**: `auth.routes.ts`·`tenantSignup.service.ts`에 로직을 무한히 붙이지 않고, **`auth-signup` 모듈**로 모은 뒤 기존 파일은 thin wrapper 또는 re-export.

---

## 현재 상태 (2026-08)

| 항목 | 상태 |
|------|------|
| 비밀번호 셀프 가입 (`/signup`) | ✅ 운영 중 |
| Google/Kakao OAuth | ❌ 미구현 |
| 가입 시 사업자 구분 | ❌ 미구현 |
| `User.passwordHash` nullable | ❌ → ✅ Phase 1 |
| SNS 1계정 = 1업체 1사용자 | 📋 POLICY 확정 |
| 서버 모듈 `auth-signup/` | ✅ Phase 1 스캐폴드 |

---

## 배포·DB

- 스키마 변경은 **`prisma migrate`만** — `.cursor/rules/prisma-migrate-and-deploy.mdc`
- 공개 API는 **`resolvePublicTenantIdFromRequest` 패턴 불필요** (테넌트 slug는 가입 **생성** 단계)
- 푸시 기본 브랜치: **`staging`** — `.cursor/rules/git-staging-main-push.mdc`

---

## Phase 0 완료 기준

- [x] 본 폴더 문서 5종 작성
- [x] Phase 1 스키마·모듈 스캐폴드
- [ ] Phase 2 착수 (`/signup` 사업자 단계)
