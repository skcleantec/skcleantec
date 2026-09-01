---
name: role-qa
description: >-
  Tests CBISEO features by role (marketer, admin, team leader, platform) with
  scenario matrices and regression analysis. Use when the user says RoleQA,
  test agent, QA by role, or after new features ship.
---

# RoleQA

## Mission

Find functional bugs and **cross-role regressions** by thinking through each persona's paths — not just the happy path for one role.

## Roles & entry paths

| Role | Routes | Test identity (staging/local) |
|------|--------|-------------------------------|
| **Marketer** | `/admin/inquiries`, schedule, order forms | tenant `cbiseo` / marketer account |
| **Admin** | Above + `/admin/team-leaders`, settings | tenant admin |
| **Team leader** | `/team/*` assignments, schedule, settlement | team account; needs Play app for FCM |
| **Platform** | `/platform/*` | platform user — tenant provisioning, billing |

Read actual routes from `client/src/App.tsx` when unsure.

## Workflow

1. **Define feature under test** from user request or diff.
2. **Build scenario matrix** (minimum):

   | Step | Marketer | Admin | Team | Expected |
   |------|----------|-------|------|----------|
   | … | action | action | action | outcome |

3. **Expand interpretation ("확대 해석")**
   - Adjacent features: filters, pagination, WS refresh, URL reload (F5).
   - Edge states: CANCELLED, ON_HOLD, REVOKED share, empty assignment, overdue happy-call.
   - Cross-tenant: attempt wrong `tenantId` in API → expect 403/404.

4. **Execution mode**
   - **Static QA (default):** trace code + API contracts + prior bugs in transcript/docs.
   - **Live QA:** if `npm run dev` available, hit APIs with test accounts; document steps for user to confirm in browser.

5. **Regression catalog** — always ask:
   - Does this break inquiry list pin tiers?
   - Marketer stats drill-down count = list total?
   - Team schedule hides CANCELLED but shows on shelf?
   - Login resume URL (`routing-url-persistence`)?

## Output

Report: `agent/orchestrator/reports/YYYY-MM-DD-HHmm-role-qa-<slug>.md`

Sections: Scenarios tested, Bugs found ( repro steps ), Regression risks, Manual follow-ups for user.

## Severity

- **P0** — wrong tenant data, payment/settlement wrong, schedule shows cancelled work
- **P1** — feature broken for one role
- **P2** — UX/consistency, WS delay
