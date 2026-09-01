# RoleQA — First Maestro run

**Feature bundle:** Happy call, team schedule KST, platform promo, staff app update, kakao FAB removal  
**Run:** 2026-09-01 11:40 KST (static trace + prior incident context)

## Scenario matrix

| # | Marketer / Admin | Team leader | Expected |
|---|------------------|-------------|----------|
| 1 | Schedule inquiry with tomorrow `preferredDate`, assign team leader | Open `/team/schedule` tomorrow AM/PM | Card appears in correct bucket; KST date matches |
| 2 | — | Happy call incomplete, **today/tomorrow** job, **assigned**, **Play app** + FCM | 18:00+ KST hourly FCM (not alimtalk) |
| 3 | — | Happy call overdue (e.g. 8/16 job, today 9/1) | UI shows overdue; **no cron push** (today/tomorrow scan only) |
| 4 | — | Web team only (no Play) | No FCM; must use in-app happy-call UI |
| 5 | Platform admin enables promo for `tenant_staff` | Team dashboard / GNB | Carousel visible; image refreshes after promo `updatedAt` |
| 6 | — | EXTERNAL_PARTNER login | Promo audience `external_partner` list |
| 7 | Admin | cbiseo.com marketing PC | **No kakao FAB** (removed) |
| 8 | — | Staff app version &lt; min | Required update modal blocks until update |
| 9 | — | Optional update available | Dismissible banner; FLEXIBLE Play update |

## Bugs / gaps found

| Sev | Issue | Repro / note |
|-----|-------|----------------|
| **P1** | Cron + D2 alimtalk may not run in prod until **Railway happy-call-cron redeploy** | Uncommitted infra/workflow; manual ops check |
| **P2** | Overdue happy-call **UI vs push expectation** | Users may expect push for old overdue; product = no push |
| **P2** | Branch behind `main` by 7 | Merge/regression risk on team + promo paths |

## Regression risks

- Inquiry list pin tiers — **not touched** ✅
- Marketer stats drill-down — **not touched** ✅
- Share REVOKED → mirror CANCELLED — **fixed in 7c29dce8**; retest revoke flow on staging
- URL persistence on team schedule filters — verify F5 on `/team/schedule` query params

## Manual follow-ups (user)

1. SK tenant: assign tomorrow jobs → confirm 서청일-style case gets push at 18:00 with Play app.
2. POST dry-run: `/api/admin/cron/happy-call-reminders?dryRun=1` and `alimtalk-schedule-d2?dryRun=1`.
3. Play **v30/v31** telecrm + staff app manifest Railway vars aligned with AAB.
