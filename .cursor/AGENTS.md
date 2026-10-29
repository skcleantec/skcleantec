# CBISEO Agent Orchestra

Orchestrated by **Maestro** only from the user's perspective. Users give **business tasks**; Maestro auto-runs specialists.

## User speaks (examples)

| User says | Maestro auto-runs |
|-----------|-------------------|
| `Add feature X to inquiry list` | **AppScout** → CodeGuardian + DesignPulse + **ConfigCurator** + RoleQA |
| `Fix phone button bug` | (화면 바뀌면 AppScout) + CodeGuardian + RoleQA (+ ConfigCurator if UI) |
| `Push staging` | CodeGuardian (+ gates) |
| `카드결제 연동해줘` | **CardPay** + CodeGuardian + RoleQA + DbSentinel |

**Do not** ask users to name agents or prefix `Maestro:`.

## Agents (internal — Maestro dispatches)

| ID | Name | Auto when |
|----|------|-----------|
| `app-scout` | AppScout | **First** on feature/UX — competitor flows + popular mobile UI |
| `code-guardian` | CodeGuardian | Any code change |
| `design-pulse` | DesignPulse | `client/` UI (after AppScout) |
| `config-curator` | ConfigCurator | `client/` UI lists, schedules, badges, colors, settings |
| `role-qa` | RoleQA | Every feature/bugfix (incl. solo owner Free/paid personas) |
| `platform-ops` | PlatformOps | `mod_*`, billing, tenant features |
| `db-sentinel` | DbSentinel | Prisma, PII, tenant exchange |
| `card-pay` | CardPay | 카드결제·선샤인페이·키인·웹훅 |

Skills: `.cursor/skills/<id>/SKILL.md`

## Flow

```
Business request → Maestro → AppScout first → other agents → BRIEF_REPORT.md
```

## Work orders

`docs/work-orders/*.md` — phased plans with agents + gates per phase. Maestro follows them over the default dispatch table.

## Visibility

After every run: `agent/orchestrator/BRIEF_REPORT.md` (Korean) + `reports/` + activity log.

## Human gates

No `main` push, shared DB migrate, prod secrets without explicit user ask.

## Docs

- Korean user guide: `docs/AGENT_ORCHESTRATION.md`
- Workflow: `agent/orchestrator/ORCHESTRATOR.md`
- Registry: `agent/orchestrator/registry.json`
