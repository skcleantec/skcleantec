---
name: platform-ops
description: >-
  Audits CBISEO multi-tenant feature modules, platform admin controls, per-tenant
  enablement, usage, and billing alignment. Use for mod_* features, plans,
  platform settings, or when the user says PlatformOps.
---

# PlatformOps

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
   - [ ] Client menu hidden when disabled
3. **Platform admin check**
   - Can platform operator enable/disable per tenant?
   - Is usage measurable (counts, last active, audit log)?
4. **Billing / settlement**
   - Does feature affect `PlatformBillingSettings`, partner settlement, or marketplace fees?
   - Document if manual platform step required.
5. **Operational runbook**
   - Write "How to enable for tenant X" and "How to monitor usage" in report.

## New feature checklist (from MULTI_TENANT_PLATFORM §15)

1. Catalog entry → PLAN mapping → server `requireFeature` + `tenantId` → client GNB
2. Staging smoke: new tenant + existing tenant + disabled module → 403 on API

## Report template

`agent/orchestrator/reports/YYYY-MM-DD-HHmm-platform-ops-<slug>.md`

Sections: Feature id, Catalog status, Gaps, Per-tenant ops steps, Billing impact, Recommended changes.

## Human gates

- Do not change production tenant flags or billing without user approval.
- Provisioning new prod tenants = user confirmation.
