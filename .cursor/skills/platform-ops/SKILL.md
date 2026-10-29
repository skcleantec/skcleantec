---
name: platform-ops
description: >-
  Audits CBISEO multi-tenant feature modules, platform admin controls, per-tenant
  enablement, usage, and billing alignment. Use for mod_* features, plans,
  platform settings, or when the user says PlatformOps.
---

# PlatformOps

## Maestro

Invoked **automatically** when Maestro detects `mod_*`, billing, tenant feature, or platform admin work. User does not call you by name.

## Mission

Ensure every feature is **manageable from the platform layer**: catalogued, gated by plan, observable per tenant, and aligned with billing/settlement rules.

## Single sources

| Concern | Location |
|---------|----------|
| Feature catalog + NAV | `shared/tenantFeatureModules.ts` |
| Server gate | `requireFeature('mod_*')` in routes |
| Client gate | `FeatureGate`, `useTenantCapabilities` |
| Platform UI | `client/src/pages/platform/*` |
| Architecture | `docs/MULTI_TENANT_PLATFORM.md` |
| Tenant provisioning | `server/src/modules/platform/tenantProvisioning.service.ts` |

## Workflow

1. **Identify feature** (new or changed) — module id, API routes, GNB entries.
2. **Catalog check**
   - [ ] `mod_*` in `tenantFeatureModules.ts` with label, plan tier, nav mapping
   - [ ] Server routes wrapped with `requireFeature`
   - [ ] Client menu follows **3-state visibility** (below) — not simply hidden
3. **Platform admin check**
   - Can platform operator enable/disable per tenant?
   - Is usage measurable (counts, last active, audit log)?
4. **Billing / settlement**
   - Does feature affect `PlatformBillingSettings`, partner settlement, or marketplace fees?
   - Document if manual platform step required.
5. **Operational runbook**
   - Write "How to enable for tenant X" and "How to monitor usage" in report.

## 3-state visibility (메뉴 노출 3단계) — 필수

기능이 꺼져 있다고 무조건 숨기지 않는다. 사용자가 기능이 있는 줄도 모르면 업그레이드가 안 된다.

| 상태 | 판정 | 화면 |
|------|------|------|
| **enabled** | `hasFeature(enabled, mod)` | 정상 노출 |
| **locked** (플랜 잠금) | 현재 플랜 `modulesForPlan(plan)`에 없고, 상위 플랜에는 있음 | 메뉴에 🔒 + 「Standard부터」 같은 배지. 클릭 → 업그레이드 안내(기능 설명 + `/admin/subscription`). **대시보드로 redirect 금지** |
| **hidden** | 플랜에는 포함인데 업체/플랫폼이 끔, 또는 역할상 볼 수 없음(마케터 권한 등) | 숨김 |

- 판정 함수는 `shared/`에 하나만 둔다 (예: `tenantModuleVisibility(mod, plan, enabled)`). GNB(`client/src/constants/adminNav.ts`), 사이드(`filterAdminSideNavByFeatures.ts`), 라우트(`FeatureGate`)가 **같은 함수**를 쓴다.
- 서버 `requireFeature`는 그대로 403 — 잠금은 화면 표시 문제이지 권한 완화가 아니다.
- 잠금 배지 문구의 플랜명은 `shared/tenantPlanCatalog.ts`에서 가져온다 (하드코딩 금지).

## Solo(1인) operator check

1인 업체(현재 판별: `core_assignments` OFF — 판별 함수는 `.cursor/rules/solo-operator-mode.mdc`)에서:
- [ ] 팀장에게 가던 알림·가계부·현장 기능이 **관리자에게** 오는가
- [ ] 1인에게 의미 없는 메뉴(배정 등)는 locked로 보이되 「직원이 생기면 Standard부터」 맥락 문구
- [ ] Free→유료 업그레이드 시 잠금이 즉시 풀리는가 (`/auth/me` 재조회)

## New feature checklist (from MULTI_TENANT_PLATFORM §15)

1. Catalog entry → PLAN mapping → server `requireFeature` + `tenantId` → client GNB
2. Staging smoke: new tenant + existing tenant + disabled module → 403 on API

## Report template

`agent/orchestrator/reports/packs/YYYY-MM-DD-<slug>/platform-ops.md`

Sections: Feature id, Catalog status, Gaps, Per-tenant ops steps, Billing impact, Recommended changes.

## Human gates

- Do not change production tenant flags or billing without user approval.
- Provisioning new prod tenants = user confirmation.
