---
name: role-qa
description: >-
  Tests CBISEO features by role (marketer, admin, team leader, platform) with
  scenario matrices and regression analysis. Use when the user says RoleQA,
  test agent, QA by role, or after new features ship.
---

# RoleQA

## Maestro

Invoked **automatically** after every feature or bugfix before Maestro marks complete. User does not call you by name.

## Mission

Find functional bugs and **cross-role regressions** by thinking through each persona's paths — not just the happy path for one role.

## Roles & entry paths

| Role | Routes | Test identity (staging/local) |
|------|--------|-------------------------------|
| **Marketer** | `/admin/inquiries`, schedule, order forms | tenant `cbiseo` / marketer account |
| **Admin** | Above + `/admin/team-leaders`, settings | tenant admin |
| **Team leader** | `/team/*` assignments, schedule, settlement | team account; needs Play app for FCM |
| **Platform** | `/platform/*` | platform user — tenant provisioning, billing |
| **Solo owner (Free)** | `/admin/*` — 1인 사장. 상담+현장+가계부 | Free 플랜 테넌트 ADMIN, 팀장 0명 |
| **Solo owner (유료)** | 위와 같음 + 알림톡·카드결제 등 | Standard 테넌트 ADMIN, 배정 OFF |

Read actual routes from `client/src/App.tsx` when unsure.

## Workflow

1. **Define feature under test** from user request or diff.
2. **Build scenario matrix** (minimum):

   | Step | Marketer | Admin | Team | Expected |
   |------|----------|-------|------|----------|
   | … | action | action | action | outcome |

2b. **Plan matrix** — 화면·메뉴가 바뀌면 필수

   | 메뉴/기능 | Free 1인 | 유료 1인 | Standard 본사 | 기대 |
   |-----------|----------|----------|---------------|------|
   | … | enabled/locked/hidden | … | … | locked는 🔒+업그레이드 안내, 403 아님 |

   - locked 메뉴 클릭 → 대시보드로 튕기지 않고 안내 화면이 뜨는가
   - 1인 관리자에게 해피콜·일정변경 푸시가 오는가 (팀장 0명이어도)
   - 본사형 테넌트는 기존과 **완전히 동일**한가 (회귀 최우선)

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

Report: `agent/orchestrator/reports/packs/YYYY-MM-DD-<slug>/role-qa.md`

Sections: Scenarios tested, Bugs found ( repro steps ), Regression risks, Manual follow-ups for user.

## Severity

- **P0** — wrong tenant data, payment/settlement wrong, schedule shows cancelled work
- **P1** — feature broken for one role
- **P2** — UX/consistency, WS delay
