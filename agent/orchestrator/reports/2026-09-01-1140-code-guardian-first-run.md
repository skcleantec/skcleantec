# CodeGuardian — First Maestro run

**Scope:** Last 5 commits + working tree (branch `fix/kakao-fab-remove`)  
**Run:** 2026-09-01 11:40 KST

## Commands run

| Command | Result |
|---------|--------|
| `cd client; npx tsc -b --noEmit` | ✅ pass |
| `cd server; npx tsc --noEmit` | ✅ pass |

## Files / areas reviewed

- Team: `teamInquiryResponse.helpers.ts`, `team.routes.ts`, `TeamSchedulePage.tsx`, `TeamDashboardPage.tsx`
- Happy call: `happyCall.helpers.ts`, `infra/happy-call-cron/`, `alimtalkScheduleD2.cron.routes.ts`
- Staff app update: `StaffAppUpdateBanner.tsx`, `shared/staffAppManifest.ts`, Android bridge
- Platform promo: `PlatformPromoDisplay.tsx`, `teamPlatformPromo.routes.ts`
- Tenant share: commit `7c29dce8` (mirror CANCELLED on revoke)
- Agent orchestra: `.cursor/skills/*`, `docs/AGENT_ORCHESTRATION.md` (untracked)

## Rules applied

- `project-standards.mdc`, `multitenant-safety.mdc`, `team-realtime-websocket.mdc`
- `tenant-inquiry-share-status.mdc`, `team-mobile-compact-ui.mdc`, `responsive-ui.mdc`
- `client-page-modularization.mdc`, `prisma-migrate-and-deploy.mdc`

## Findings

### BLOCKER

_None._

### HIGH

1. **Branch drift** — `fix/kakao-fab-remove` is **ahead 1, behind 7** vs `origin/main`. Large uncommitted set (happy-call cron, telecrm v30 docs, team KST) should be **committed and merged via staging** before prod to avoid partial deploy.

### MEDIUM

1. **Working tree noise** — Many untracked paths (`.worktrees/`, `_wt-staging/`, soomgo decompile artifacts, `diagnose-*.ts`). Risk: accidental commit. Recommend `.gitignore` tighten or move scripts to `server/scripts/` and commit intentionally.
2. **Agent orchestra not committed** — Skills + `docs/AGENT_ORCHESTRATION.md` still untracked; team cannot reuse Maestro until pushed to `staging`.
3. **Happy-call cron infra** — Uncommitted changes to `infra/happy-call-cron/` + workflow; **Railway cron job must be redeployed** after merge or D2 alimtalk + happy-call won't run together in prod.
4. **`TeamSchedulePage.tsx`** — ~616 lines; within legacy tolerance but watch for further growth without extraction.

### LOW

1. **`happyCallCronPreferredDateRange`** — Today/tomorrow only (by product decision). Documented in `docs/HAPPY_CALL_CRON.md`; CodeGuardian confirms no accidental 60-day lookback in current file.
2. **KST `preferredDate` serialization** — Good fix in `serializeTeamInquiryPreferredDateKst`; aligns client `dateFormat` / schedule buckets.

## Related modules checked

- `inquiryListDateRange.ts` (happy call date math)
- `platform-partner-promo/*` (promo list, cache headers)
- `push/staffAppManifest.ts` (version gate)

## Recommendation

1. Commit orchestra + intentional server/client/cron changes to **`staging`**.
2. Exclude junk untracked dirs from git.
3. After deploy: run happy-call + alimtalk D2 dry-run against staging API.
