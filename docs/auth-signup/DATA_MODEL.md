# ADMIN SNS 가입 — 데이터 모델

> Prisma 변경 시 **반드시** `server/prisma/migrations/**` SQL 동반 — `.cursor/rules/prisma-migrate-and-deploy.mdc`

---

## 1. 신규 enum

```prisma
enum SignupBusinessType {
  registered_business  // 사업자
  individual           // 비사업자
}

enum AuthIdentityProvider {
  google
  kakao
}
```

공유 TypeScript: `shared/authSignup.ts` — Prisma enum과 문자열 동기.

---

## 2. `TenantSignupBusiness` (신규)

가입 시점 사업자/비사업자 스냅샷. **테넌트 1:1**.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | UUID | ✅ | PK |
| `tenantId` | UUID | ✅ | FK → Tenant, **unique** |
| `businessType` | SignupBusinessType | ✅ | |
| `bizNumber` | VarChar(64)? | 사업자만 | 하이픈 제거 저장 권장 |
| `businessName` | VarChar(128)? | 사업자만 | 상호 |
| `representativeName` | VarChar(128)? | 사업자만 | 대표자 실명 |
| `addressLine` | Text? | | 사업장 주소 |
| `businessRegistrationImageUrl` | VarChar(2048)? | 사업자만 | |
| `businessRegistrationImagePublicId` | VarChar(512)? | | Cloudinary |
| `individualConfirmedAt` | DateTime? | 비사업자만 | 확인 체크 시각 |
| `individualUsageNote` | VarChar(256)? | | 개인/프리랜서 등 |
| `submittedAt` | DateTime | ✅ | complete 시각 |
| `createdAt` / `updatedAt` | DateTime | ✅ | |

**인덱스**

- `@@unique([tenantId])`
- (선택 Phase 2+) `@@index([bizNumber])` — 중복 가입 탐지용

**관계**

```prisma
model Tenant {
  // ...
  signupBusiness TenantSignupBusiness?
}
```

---

## 3. `UserAuthIdentity` (신규)

SNS ↔ User 연결. **POLICY: 1 SNS = 1 user globally**.

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | UUID | ✅ | |
| `tenantId` | UUID | ✅ | FK → Tenant (조회·격리) |
| `userId` | UUID | ✅ | FK → User |
| `provider` | AuthIdentityProvider | ✅ | google \| kakao |
| `providerSub` | VarChar(128) | ✅ | OAuth `sub` |
| `providerEmail` | VarChar(256)? | | 참고용, 로그인 미사용 |
| `linkedAt` | DateTime | ✅ | |
| `createdAt` | DateTime | ✅ | |

**제약**

```prisma
@@unique([provider, providerSub])           // 전역 1 SNS 1계정
@@unique([tenantId, userId, provider])      // 유저당 provider 1개
@@index([tenantId, userId])
```

---

## 4. `User` 변경

| 필드 | 변경 | 설명 |
|------|------|------|
| `passwordHash` | **nullable** | SNS-only ADMIN |
| `name` | NOT NULL 유지 | **실명** — 가입 시 검증 강화 |
| `recoveryEmail` | nullable → **SNS 가입 시 NOT NULL** | 앱 레벨 검증 (기존 행 호환) |

기존 행: `passwordHash` 그대로 — 마이그레이션은 `ALTER COLUMN ... DROP NOT NULL` only.

---

## 5. `Tenant.config.signup` (기존 JSON 보조)

`provisionTenantSelfServe`가 이미 저장:

- `contactEmail`, `contactPhone`, `emailVerifiedAt`, `memberTermsAgreedAt`, `source: 'self_serve'`

**추가 (선택)**

```json
{
  "signup": {
    "authMethod": "password" | "google" | "kakao",
    "adminRealName": "홍길동"
  }
}
```

정규 조회·플랫폼 UI는 **`TenantSignupBusiness` 테이블 우선**.

---

## 6. 기존 모델과의 관계 (재사용)

| 기존 | 용도 |
|------|------|
| `ExternalCompany.bizNumber` + 증빙 URL | **필드·업로드 패턴** 참고 (타업체) |
| `EContractIssuerProfile.businessRegistrationNo` | Phase 8+ 가입 사업자 정보 → seed 가능 |
| `emailVerification.service.ts` | OTP 챌린지 |
| `provisionTenantSelfServe` | Tenant + ADMIN + billing + features |

---

## 7. 마이그레이션 체크리스트

1. [ ] `schema.prisma` + `schema.template.prisma` 동기
2. [ ] `migrate dev` / SQL 폴더 커밋
3. [ ] `npx prisma generate`
4. [ ] `npx prisma migrate deploy` (공개 DB)
5. [ ] 기존 User/password 가입 회귀 테스트

---

## 8. 멀티테넌트

- `UserAuthIdentity` 조회·삭제: **`tenantId` in where**
- OAuth login: `tenantSlug` → `tenantId` resolve **후** `(tenantId, provider, providerSub)` 매칭
- **`providerSub`만**으로 User 조회 **금지** (다른 tenant 유출 위험은 낮지만 slug 누락 방지)
