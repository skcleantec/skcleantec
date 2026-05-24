# 멀티 테넌트·플랫폼 설계 (청소비서)

> **목적**: 다른 업체(테넌트)가 동일 솔루션을 쓰도록 **플랫폼(최상위)** 과 **업무(테넌트)** 를 분리하고,  
> **업체별 기능 on/off·커스터마이징**을 코드/설정으로 안전하게 제어한다.  
> **이 문서가 구현의 단일 기준**이다. 단계별 PR은 [§10 구현 로드맵](#10-구현-로드맵) 체크리스트를 따른다.

**관련 문서**: [ARCHITECTURE.md](../ARCHITECTURE.md), [PROJECT_GUIDE.md](../PROJECT_GUIDE.md)

---

## 1. 설계 원칙

| 원칙 | 설명 |
|------|------|
| **테넌트 격리** | 모든 업무 데이터는 `tenantId`로 스코프. 플랫폼 API는 테넌트 데이터에 직접 쓰지 않음(프로비저닝·상태 변경만). |
| **기능 = 모듈** | 접수·급여·전자계약 등은 **FeatureModule** 단위로 켜/끔. 메뉴·API·라우트가 같은 키를 참조. |
| **플랜 + 오버라이드** | 기본은 **Plan 템플릿**(모듈 묶음). 업체별 예외는 **TenantFeature** 오버라이드. |
| **커스텀 = 플래그 뒤** | A업체 전용 기능은 `feature:acme.xxx` 키 뒤에만 코드 분기. 공통 코드 오염 최소화. |
| **점진 이전** | 현재 SK클린텍 단일 DB → tenant 1개 백필 → 모듈·플랫폼 UI 순 추가. |
| **URL·화면 유지** | 기존 `/admin`, `/team`, `/crew`는 테넌트 업무 콘솔로 유지. 플랫폼은 `/platform` 분리. |

---

## 2. 계층 구조

```text
┌─────────────────────────────────────────────────────────────┐
│  Platform (솔루션 운영사 — SK클린텍 내부)                      │
│  PlatformUser · /platform/* · /api/platform/*               │
│  · 테넌트 CRUD · 플랜/기능 설정 · 커스텀 플래그 · 모니터링      │
└───────────────────────────┬─────────────────────────────────┘
                            │ Tenant (slug, status, plan, features)
┌───────────────────────────▼─────────────────────────────────┐
│  Tenant A (예: acme)                                          │
│  User(ADMIN/MARKETER/TEAM_LEADER/…) · /admin · /team · /crew  │
│  · Inquiry · OrderForm · Schedule · Payroll · …               │
└─────────────────────────────────────────────────────────────┘
```

### 2.1 역할 매핑 (현재 → 이후)

| 현재 | 이후 |
|------|------|
| `SUPER_ADMIN_EMAIL` + `isSuperAdmin` | **PlatformUser** (`PLATFORM_SUPER_ADMIN`) |
| `ADMIN` (업무 관리자) | **Tenant** `User.role = ADMIN` |
| 테넌트 내 특권(히스토리 삭제 등) | `User.isTenantOwner` |
| `MARKETER`, `TEAM_LEADER`, … | 변경 없음 (테넌트 스코프만 추가) |
| `TeamCrewGroup` 크루 로그인 | `tenantId` + JWT |

---

## 3. URL·라우팅

### 3.1 1차 (경로 분리)

| 경로 | 용도 |
|------|------|
| `/platform/login` | 플랫폼 운영자 로그인 |
| `/platform/tenants` | 업체 목록 |
| `/platform/tenants/new` | 업체 개설 |
| `/platform/tenants/:id` | 업체 상세·기능·플랜 |
| `/login?tenant=acme` | 테넌트 로그인 (업체 코드 + 아이디) |
| `/admin/*` | **현재 메인** — 테넌트 관리자 업무 |
| `/team/*`, `/crew/*` | 테넌트 팀장·크루 |
| `/order/:token`, `/e-contract/sign/:token` | 공개 (토큰 → tenant 역조회) |

### 3.2 2차 (선택 — 서브도메인)

```text
acme.app.example.com/admin   → Host에서 tenant slug resolve
platform.app.example.com     → 플랫폼
```

1차에서 **`Tenant.slug` + JWT `tenantId`** 를 먼저 고정한 뒤 2차를 붙인다.

---

## 4. 기능 모듈 (FeatureModule) — 핵심

업체별 **서비스 포함/제외**와 **커스텀 기능**의 기준 단위.

### 4.1 모듈 카탈로그 (코드 단일 소스)

파일: `shared/tenantFeatureModules.ts` (client·server 공통 import)

```typescript
/** 제품 기능 모듈 — 플랜·테넌트 on/off 대상 */
export const TENANT_FEATURE_MODULES = {
  // ── 접수·운영 (코어)
  core_inquiries:      { label: '서비스접수·발주서', tier: 'core', defaultOn: true },
  core_schedule:       { label: '스케줄', tier: 'core', defaultOn: true },
  core_assignments:    { label: '배정', tier: 'core', defaultOn: true },
  core_messages:       { label: '메시지', tier: 'standard', defaultOn: true },

  // ── 선택 모듈
  mod_cs:              { label: 'C/S 관리', tier: 'standard', defaultOn: true },
  mod_advertising:     { label: '광고비', tier: 'standard', defaultOn: false },
  mod_payroll:         { label: '급여·정산', tier: 'premium', defaultOn: false },
  mod_e_contract:      { label: '전자계약', tier: 'premium', defaultOn: false },
  mod_external_co:     { label: '타업체·외부정산', tier: 'standard', defaultOn: true },
  mod_crew:            { label: '크루(현장)', tier: 'standard', defaultOn: true },
  mod_team_stats:      { label: '팀장 통계', tier: 'standard', defaultOn: true },

  // ── 테넌트 전용 커스텀 (플랫폼에서만 켬)
  custom_acme_report:  { label: '[ACME] 전용 리포트', tier: 'custom', defaultOn: false },
} as const;

export type TenantFeatureModuleId = keyof typeof TENANT_FEATURE_MODULES;
```

**규칙**

- **코어(`core_*`)**: 끄면 업무가 성립하지 않음 → 플랫폼 UI에서 off 금지(또는 테넌트 중지만 허용).
- **선택(`mod_*`)**: 플랜/업체별 on/off.
- **커스텀(`custom_{tenantKey}_*`)**: 해당 업체 또는 플랫폼 승인 시에만 활성화.

### 4.2 현재 화면 ↔ 모듈 매핑

| 모듈 ID | 관리자 GNB / 경로 | 서버 모듈 (대표) |
|---------|-------------------|------------------|
| `core_inquiries` | 서비스접수 `/admin/inquiries` | `inquiries`, `orderform`, `order-followups` |
| `core_schedule` | 스케줄 `/admin/schedule` | `schedule` |
| `core_assignments` | (접수·스케줄 내) | `assignments` |
| `core_messages` | 메시지 `/admin/messages` | `messages` |
| `mod_cs` | C/S `/admin/cs` | `cs` |
| `mod_advertising` | 광고비 `/admin/advertising` | `advertising` |
| `mod_payroll` | 급여 `/admin/team-leaders/payroll` | `admin-payroll` |
| `mod_e_contract` | 전자계약 `/admin/team-leaders/e-contracts` | `e-contract` |
| `mod_external_co` | 타업체 `/admin/team-leaders/external-*` | `external-companies`, `team` |
| `mod_crew` | 크루 `/crew` | `crew`, `team-crew-groups` |
| `mod_team_stats` | 팀장 통계 등 | `teams`, `dashboard` |

클라이언트 `adminNav.ts`·`App.tsx` 라우트·서버 `app.ts` 라우터 등록 시 **동일 moduleId** 로 가드한다.

### 4.3 플랜(Plan) = 모듈 묶음

```typescript
export const TENANT_PLANS = {
  starter: {
    label: 'Starter',
    modules: ['core_inquiries', 'core_schedule', 'core_assignments', 'core_messages'],
  },
  standard: {
    label: 'Standard',
    modules: [/* starter + */ 'mod_cs', 'mod_external_co', 'mod_crew', 'mod_team_stats'],
  },
  premium: {
    label: 'Premium',
    modules: [/* standard + */ 'mod_advertising', 'mod_payroll', 'mod_e_contract'],
  },
} as const;
```

DB `Tenant.plan` → 기본 enabled set. 업체별 추가/제거는 `TenantFeature` 행으로 오버라이드.

### 4.4 테넌트별 effective features 계산

```text
effectiveModules =
  PLAN_MODULES[tenant.plan]
  ∪ { enabled where TenantFeature.enabled = true }
  − { disabled where TenantFeature.enabled = false }
  ∩ { tenant.status === ACTIVE }
```

API: `GET /api/tenant/capabilities` 또는 `GET /api/auth/me` 에 포함.

```json
{
  "tenant": { "id": "…", "slug": "acme", "name": "A청소", "plan": "standard" },
  "features": ["core_inquiries", "mod_cs", "custom_acme_report"],
  "config": { "orderForm": { "…": "…" } }
}
```

---

## 5. 커스터마이징 3단계

| 단계 | 수단 | 용도 | 예 |
|------|------|------|-----|
| **L1 설정** | `Tenant.config` (JSON) | UI 문구·한도·기본값 | 발주서 안내 문구, 접수번호 prefix |
| **L2 모듈** | Feature on/off | 서비스에서 기능 제거 | B업체는 `mod_payroll` off |
| **L3 커스텀 코드** | `custom_{slug}_*` feature + 분기 | A업체만 전용 화면/API | `custom_acme_report` 라우트·페이지 |

**L3 규칙**

- 분기는 **`if (hasFeature('custom_acme_report'))`** 한곳으로 모음.
- 가능하면 `server/src/modules/custom/acme/` · `client/src/pages/custom/acme/` 폴더 격리.
- 플랫폼 UI에서 해당 테넌트에만 커스텀 모듈 토글.

---

## 6. 데이터베이스 (Prisma)

### 6.1 플랫폼·테넌트

```prisma
enum TenantStatus {
  TRIAL
  ACTIVE
  SUSPENDED
}

enum PlatformRole {
  SUPER_ADMIN
  SUPPORT
}

model Tenant {
  id          String       @id @default(uuid())
  slug        String       @unique @db.VarChar(48)
  name        String       @db.VarChar(128)
  status      TenantStatus @default(ACTIVE)
  plan        String       @default("standard") @db.VarChar(32)
  timezone    String       @default("Asia/Seoul") @db.VarChar(64)
  /// L1 설정 (JSON) — 스키마는 Zod로 검증
  config      Json         @default("{}")
  createdAt   DateTime     @default(now()) @map("created_at")
  suspendedAt DateTime?    @map("suspended_at")

  users         User[]
  features      TenantFeature[]
  // … tenantId FK 보유 모델

  @@map("tenants")
}

model PlatformUser {
  id           String       @id @default(uuid())
  email        String       @unique
  passwordHash String       @map("password_hash")
  name         String
  role         PlatformRole @default(SUPER_ADMIN)
  isActive     Boolean      @default(true) @map("is_active")
  createdAt    DateTime     @default(now()) @map("created_at")

  @@map("platform_users")
}

/// 플랜 대비 per-tenant 모듈 오버라이드
model TenantFeature {
  tenantId   String  @map("tenant_id")
  moduleId   String  @map("module_id") @db.VarChar(64)  // TenantFeatureModuleId
  enabled    Boolean
  /// 커스텀 모듈 메타 (한도, URL 등)
  meta       Json    @default("{}")

  tenant Tenant @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@id([tenantId, moduleId])
  @@map("tenant_features")
}
```

### 6.2 User 변경

```prisma
model User {
  tenantId      String  @map("tenant_id")
  tenant        Tenant  @relation(...)
  email         String
  isTenantOwner Boolean @default(false) @map("is_tenant_owner")
  // … 기존 필드

  @@unique([tenantId, email])
  @@index([tenantId, role, isActive])
}
```

### 6.3 tenantId 필수 테이블 (루트)

**1차 마이그레이션 대상 (직접 FK)**

- `User`, `ExternalCompany`, `Team`, `TeamMember`, `Inquiry`, `OrderForm`
- `Assignment`, `Message`, `CsReport`
- `AdChannel`, `AdWorkSession`
- `ScheduleDayClosure`, `ScheduleDayLeaderSlot`, `ScheduleDayTeamMemberSlot`
- `ProfessionalSpecialtyOption`, `EstimateConfig`, `EstimateOption`, `OrderFormConfig`
- `TeamCrewGroup`, `Payroll*` 루트, `UserCustomCalendar`
- `EContractIssuerProfile`, `EContractFieldDefinition`, `EContractDefinition`
- `DailyInquiryCounter` → PK `(tenantId, dateKey)`

**2차 (부모 join으로 상속 가능, 이후 denormalize)**

- Inquiry/OrderForm/EContract/Ad 하위 대부분

**전역 unique 조정**

- `Inquiry.inquiryNumber` → `@@unique([tenantId, inquiryNumber])`
- `User.email` → `@@unique([tenantId, email])`

---

## 7. 인증·JWT

### 7.1 페이로드

```typescript
// 테넌트 사용자
{ kind: 'tenant', userId, tenantId, email, role }

// 크루
{ kind: 'crew', tenantId, crewGroupId, role: 'TEAM_CREW_GROUP', … }

// 플랫폼
{ kind: 'platform', platformUserId, email, role: 'SUPER_ADMIN' | 'SUPPORT' }
```

### 7.2 로그인

```http
POST /api/auth/login
{ "tenantSlug": "acme", "email": "admin", "password": "…" }

POST /api/platform/auth/login
{ "email": "platform@…", "password": "…" }
```

`SUSPENDED` 테넌트 → 403. 비활성 모듈 API → 404 또는 403 `feature_disabled`.

---

## 8. 서버 구조

```text
server/src/modules/
  platform/
    platformAuth.routes.ts
    tenants.routes.ts              # CRUD + features PATCH
    tenantProvisioning.service.ts  # 생성 + 시드
  tenants/
    tenant.middleware.ts           # JWT tenantId
    tenantFeatures.service.ts      # effective modules
    requireTenantFeature.ts        # API 가드
    tenantConfig.schema.ts         # Tenant.config Zod
  custom/                          # L3 업체별 (선택)
    acme/
```

### 8.1 API 가드 패턴

```typescript
// advertising.routes.ts
router.get('/analytics', authMiddleware, requireTenantAuth, requireFeature('mod_advertising'), …);
```

### 8.2 Prisma 쿼리 패턴

```typescript
const rows = await prisma.inquiry.findMany({
  where: { tenantId: req.tenantId!, … },
});
```

### 8.3 플랫폼 API (MVP)

| Method | Path | 설명 |
|--------|------|------|
| GET | `/api/platform/tenants` | 목록 |
| POST | `/api/platform/tenants` | 생성 + provisioning |
| GET | `/api/platform/tenants/:id` | 상세 |
| PATCH | `/api/platform/tenants/:id` | 이름·status·plan |
| PUT | `/api/platform/tenants/:id/features` | 모듈 on/off 일괄 |
| PATCH | `/api/platform/tenants/:id/config` | L1 JSON 설정 |

---

## 9. 클라이언트 구조

```text
client/src/
  shared/tenantFeatureModules.ts   # 또는 repo root shared/
  hooks/useTenantCapabilities.ts
  pages/platform/
    PlatformLoginPage.tsx
    PlatformTenantListPage.tsx
    PlatformTenantCreatePage.tsx
    PlatformTenantDetailPage.tsx      # 기능 토글 UI
  components/layout/PlatformLayout.tsx
  components/auth/PlatformProtectedRoute.tsx
  stores/platformAuth.ts
  pages/custom/acme/                  # L3
```

### 9.1 GNB·라우트 가드

```typescript
// adminNav.ts
export function canShowAdminNavItem(id: AdminNavId, ctx: NavContext): boolean {
  if (!hasFeature(ctx.features, NAV_MODULE_MAP[id])) return false;
  if (ADMIN_NAV_DEF[id].adminOnly && !ctx.isAdmin) return false;
  return true;
}
```

```tsx
// App.tsx — mod_payroll off 시
<Route path="payroll" element={
  <FeatureGate module="mod_payroll"><AdminPayrollPage /></FeatureGate>
} />
```

### 9.2 로그인

- 업체 코드(`tenantSlug`) 입력 + localStorage 기억
- 플랫폼 링크 → `/platform/login`

---

## 10. 구현 로드맵

> **각 PR은 이 문서 § 해당 절을 PR 설명에 링크한다.**  
> DB 변경 시 `prisma migrate` + `migrate deploy` (공유 DB 규칙 준수).

### Phase 0 — 문서·공통 타입 (현재)

- [x] `docs/MULTI_TENANT_PLATFORM.md` 작성
- [x] `shared/tenantFeatureModules.ts` 추가 (카탈로그 + PLAN + NAV 매핑)

### Phase 1 — 테넌트 기반 (PR-1)

**목표**: SK클린텍 1 tenant 백필, 로그인·JWT·inquiries 스코프.

- [x] `Tenant`, `PlatformUser` 마이그레이션
- [x] `User.tenantId` + 마이그레이션 SQL 백필 (기본 tenant `skcleanteck`)
- [x] `POST /api/auth/login` + `tenantSlug`
- [x] `AuthPayload.tenantId`, `requireTenantAuth`
- [x] `inquiries`, `users`, `auth/me` tenant 스코프
- [x] `LoginPage` 업체 코드 필드
- [x] **검증**: tenant 2개 수동 INSERT → 로그인·목록 격리 (`server/scripts/verify-multitenant-phase1.ts`)

### Phase 2 — 기능 모듈 인프라 (PR-2)

**목표**: on/off가 메뉴·API에 반영.

- [x] `TenantFeature` 모델 + `tenantFeatures.service.ts`
- [x] `GET /api/tenant/capabilities`
- [x] `requireFeature(moduleId)` 미들웨어
- [x] `useTenantCapabilities` + `adminNav` 필터
- [x] `FeatureGate` 컴포넌트 + `App.tsx` 주요 라우트
- [x] **검증**: `mod_advertising` off → GNB·API 403 (`server/scripts/verify-multitenant-phase2.ts`)

### Phase 3 — 플랫폼 콘솔 MVP (PR-3)

**목표**: 업체 개설·기능 토글.

- [x] `/platform/login`, `PlatformLayout`, `platformAuth`
- [x] 업체 목록·생성·상세 UI
- [x] `tenantProvisioning.service` (ADMIN + config 시드)
- [x] 플랫폼에서 Plan·Feature PATCH
- [x] **검증**: 새 업체 생성 → starter만 → premium 모듈 미노출 (`server/scripts/verify-multitenant-phase3.ts`)

### Phase 4 — 전 테이블 tenantId (PR-4)

**목표**: 데이터 유출 방지 완료.

- [x] §6.3 루트 테이블 `tenantId` + 백필 (`20260525140000_multitenant_phase4_core`, `20260525160000_multitenant_phase4b_extended`)
- [x] `server/src/modules/*` tenant 스코프 (schedule·dashboard·payroll·crew·e-contract·calendar·dayoffs·realtime staff broadcast 포함)
- [x] `DailyInquiryCounter` PK `(tenantId, dateKey)`, `allocateNextInquiryNumber(tx, tenantId)`
- [x] **검증**: 크로스 테넌트 발주서·C/S 404 (`npm run verify:multitenant:phase4`)

> **Phase 5 완료**: `isTenantOwner` JWT·미들웨어, WS 키 `${tenantId}:${userId}`, 공개 발주서·전자계약 tenant 검증.

### Phase 5 — 역할 정리·WS (PR-5)

- [x] `isSuperAdmin` → `isTenantOwner` (JWT·`/me`·광고·고용일·변경이력 삭제) — 플랫폼은 `PlatformUser` 유지
- [x] WebSocket 키 `tenantId:userId` + `notifyInboxRefresh` tenant 조회
- [x] 공개 `/order`, `/e-contract` tenant 검증 (slug·SUSPENDED)
- [x] **검증**: `npm run verify:multitenant:phase5`

### Phase 6 — L1/L3·서브도메인 (선택)

- [x] `Tenant.config` 스키마·검증 + 플랫폼 L1 JSON UI
- [x] `server/src/modules/custom/` 템플릿·카탈로그·mount 훅
- [x] Host → slug resolve (`GET /api/tenant/resolve-host`, 로그인 Host 연동)
- [x] **검증**: `npm run verify:multitenant:phase6`

---

## 11. 모듈별 tenant 스코프 체크리스트 (Phase 4)

| 서버 모듈 | Feature | tenantId |
|-----------|---------|----------|
| `inquiries` | core_inquiries | ☑ |
| `orderform` | core_inquiries | ☑ |
| `assignments` | core_assignments | ☑ |
| `schedule` | core_schedule | ☑ |
| `messages` | core_messages | ☑ |
| `cs` | mod_cs | ☑ |
| `advertising` | mod_advertising | ☑ |
| `admin-payroll` | mod_payroll | ☑ |
| `e-contract` | mod_e_contract | ☑ |
| `external-companies` | mod_external_co | ☑ |
| `team`, `teams` | mod_external_co / core | ☑ |
| `crew`, `team-crew-groups` | mod_crew | ☑ |
| `dashboard` | core | ☑ |
| `users` | core | ☑ (Phase 1) |
| `dayoffs`, `user-custom-calendars` | core | ☑ |
| `inquiry-*` (photos, charges, …) | core_inquiries | ☑ (접수 경유) |
| `order-followups` | core_inquiries | ☑ |
| `realtime` | core | ☑ (staff broadcast 테넌트별) |

---

## 12. 프로비저닝 (업체 생성 시)

`tenantProvisioning.service.ts` 순서:

1. `Tenant` insert (slug, name, plan, status=TRIAL)
2. `TenantFeature` — plan 기본 모듈 insert
3. `User` ADMIN (`isTenantOwner=true`)
4. `EstimateConfig`, `OrderFormConfig`, `ProfessionalSpecialtyOption` 시드
5. `AdChannel` 기본 채널(네이버·인스타그램·배너·기타) — `ensureDefaultAdChannelsForTenant`
6. (선택) `EContractFieldDefinition` 시드

플랫폼 UI **업체 개설** 폼 → 위 서비스 1회 호출.

---

## 13. 기존 SK클린텍 마이그레이션

1. `Tenant { slug: 'skcleanteck', plan: 'premium', status: ACTIVE }`
2. 모든 `User` 및 §6.3 테이블 `tenantId` = skcleanteck
3. `PlatformUser` 1명 (운영용)
4. `TenantFeature` — premium 전체 enabled (또는 현재 쓰는 모듈만)
5. `isSuperAdmin` 사용처 → `isTenantOwner` / `PlatformUser` 로 치환

---

## 14. 플랫폼 UI 와이어 (Phase 3)

### 업체 상세 — 기능 탭

```text
[A청소 · acme]  ACTIVE · Plan: Standard     [중지] [저장]

[기본] [기능 모듈] [설정 JSON] [통계]

── 기능 모듈 ──
  ☑ 서비스접수·발주서 (core)     ← core는 잠금
  ☑ 스케줄
  ☐ 광고비
  ☐ 급여·정산
  ☑ C/S
  ☐ [ACME] 전용 리포트 (custom)  ← 이 테넌트만 목록에 노출

Plan 적용: [Standard ▾]  [플랜 기본값으로 재설정]
```

---

## 15. 새 기능 추가 시 체크리스트 (개발자)

1. `TENANT_FEATURE_MODULES` 에 ID 추가 (`mod_*` 또는 `custom_*`)
2. PLAN에 포함 여부 결정
3. 서버 라우트: `requireFeature('…')` + `tenantId` where
4. 클라이언트: GNB 매핑 + `FeatureGate` + 라우트
5. 플랫폼 UI: 테넌트 상세 기능 탭에 토글 노출
6. **커스텀**이면 `custom/{slug}/` 폴더 + 플랫폼에서 해당 slug만 토글 가능

---

## 16. 비목표 (1차)

- 업체별 별도 DB / 별도 배포 파이프라인
- 과금·결제 (plan 필드만预留)
- 테넌트 self-signup (플랫폼에서만 개설)
- 플러그인 동적 로드 (L3는 코드 배포 + feature flag)

---

## 17. 변경 이력

| 날짜 | 내용 |
|------|------|
| 2026-05-24 | 초안 — 플랫폼/테넌트 분리, FeatureModule, 6 Phase 로드맵 |
