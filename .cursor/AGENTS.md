# CBISEO Agent Orchestra

Orchestrated by **Maestro** only from the user's perspective. Users give **business tasks**; Maestro auto-runs specialists.

## User speaks (examples)

| User says | Maestro auto-runs |
|-----------|-------------------|
| `Add feature X to inquiry list` | CodeGuardian + DesignPulse + **ConfigCurator** + RoleQA |
| `Fix phone button bug` | CodeGuardian + RoleQA (+ ConfigCurator if UI) |
| `Push staging` | CodeGuardian (+ gates) |

**Do not** ask users to name agents or prefix `Maestro:`.

## Agents (internal — Maestro dispatches)

| ID | Name | Auto when |
|----|------|-----------|
| `code-guardian` | CodeGuardian | Any code change |
| `design-pulse` | DesignPulse | `client/` UI |
| `config-curator` | ConfigCurator | `client/` UI lists, schedules, badges, colors, settings |
| `role-qa` | RoleQA | Every feature/bugfix |
| `platform-ops` | PlatformOps | `mod_*`, billing, tenant features |
| `db-sentinel` | DbSentinel | Prisma, PII, tenant exchange |

Skills: `.cursor/skills/<id>/SKILL.md`

## Flow

```
Business request → Maestro → all applicable agents → BRIEF_REPORT.md
```

## Visibility

After every run: `agent/orchestrator/BRIEF_REPORT.md` (Korean) + `reports/` + activity log.

## Human gates

No `main` push, shared DB migrate, prod secrets without explicit user ask.

## Docs

- Korean user guide: `docs/AGENT_ORCHESTRATION.md`
- Workflow: `agent/orchestrator/ORCHESTRATOR.md`
- Registry: `agent/orchestrator/registry.json`
