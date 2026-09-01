# CBISEO Agent Orchestra

English agent names · orchestrated by **Maestro** · activity logged under `agent/orchestrator/`.

## Quick invoke (Cursor chat)

| Intent | Example prompt |
|--------|----------------|
| Full pipeline | `Maestro: review the latest changes end-to-end` |
| Design only | `DesignPulse: audit TeamSchedulePage mobile + desktop` |
| Code review | `CodeGuardian: review my diff before merge` |
| Role testing | `RoleQA: test happy-call assignment as team leader` |
| Platform ops | `PlatformOps: is mod_tenant_exchange wired for billing?` |
| DB / legal | `DbSentinel: scan tenant exchange for PII leaks` |

Skills live in `.cursor/skills/<agent-id>/SKILL.md`. Maestro loads the right skill(s) and writes a run report.

## Agents

| ID | English name | Role |
|----|--------------|------|
| `maestro-orchestrator` | **Maestro** | Routes work, merges reports, updates activity log |
| `design-pulse` | **DesignPulse** | Modern UI research + PC/mobile/app responsive design |
| `code-guardian` | **CodeGuardian** | Diff review, related code, rules/docs, module balance |
| `role-qa` | **RoleQA** | Marketer / admin / team-leader scenario testing |
| `platform-ops` | **PlatformOps** | Tenant feature flags, usage, billing, platform admin |
| `db-sentinel` | **DbSentinel** | Privacy law watch, tenant isolation, sensitive data exchange |

## Orchestration order (default)

```
User request / PR / feature change
        │
        ▼
    Maestro (triage)
        │
   ┌────┴────┬─────────┬──────────┐
   ▼         ▼         ▼          ▼
DesignPulse CodeGuardian RoleQA  PlatformOps
   (UI)      (always on      (after code   (new feature /
             code change)     stable)       billing touch)
        │         │         │          │
        └────┬────┴────┬────┴──────────┘
             ▼         ▼
        DbSentinel (schema, PII, tenant exchange, cross-tenant)
             │
             ▼
    Maestro summary → ACTIVITY_LOG.md + reports/
```

**Parallel OK:** DesignPulse + CodeGuardian on the same PR.  
**Sequential:** RoleQA after CodeGuardian fixes; DbSentinel when `server/prisma` or tenant exchange changes.

## Visibility

After every orchestrated run, Maestro **must**:

1. **Overwrite** `agent/orchestrator/BRIEF_REPORT.md` — **Korean brief report for the user (primary)**
2. Append one JSON line to `agent/orchestrator/activity-log.jsonl`
3. Refresh `agent/orchestrator/ACTIVITY_LOG.md`
4. Save detail report: `agent/orchestrator/reports/YYYY-MM-DD-HHmm-<agent>-<slug>.md`

## Human approval gates (never bypass)

- `main` push, production Railway vars, Play Console submit
- `prisma migrate deploy` on shared DB (unless user explicitly asked)
- Destructive git, bulk data delete, tenant provisioning in prod

## Related docs

- User guide (Korean): `docs/AGENT_ORCHESTRATION.md`
- Registry: `agent/orchestrator/registry.json`
- Workflow detail: `agent/orchestrator/ORCHESTRATOR.md`
- Existing guide agent (docs only): `agent/GUIDE_AGENT.md` → **GuideRosie** (not in orchestra; manual trigger)
