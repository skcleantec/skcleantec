# DbSentinel — First Maestro run

**Run:** 2026-09-01 11:40 KST

## Legal / privacy watch (summary)

- **PIPA (KR):** Customer name, phone, address, job site notes, photos remain sensitive. Alimtalk D2 sends schedule confirmation to **customer phone** — ensure consent/contract basis documented in tenant terms (not re-audited in code this run).
- **Recommendation:** Periodic review of retention for `InquiryChangeLog`, photos on Cloudinary, C/S tickets — no schema change this sprint.

## Tenant isolation

| Area | Finding |
|------|---------|
| Team routes | No `findUnique({ id })` without tenant path in `team/` grep ✅ |
| Platform promos | Global read model; filtered by **role audience**, not cross-tenant inquiry leak ✅ |
| Happy call cron | Admin cron secret; job should scope by tenant on inquiry/assignment (existing service — no new raw SQL in diff) |

## Sensitive exchange (amounts + job info)

| Area | Finding |
|------|---------|
| Tenant share revoke | Commit `7c29dce8` aligns with **mirror CANCELLED + fee stamp** rule ✅ |
| Team API KST dates | Display/sync fix only; no new fields exposed cross-tenant ✅ |

## Migration safety

- No uncommitted `schema.prisma` / migration in working tree ✅

## Operational security

| Item | Severity |
|------|----------|
| `ALIMTALK_CRON_SECRET` falls back to `HAPPY_CALL_CRON_SECRET` | **MEDIUM** — convenient but single secret compromise affects both jobs; acceptable if Railway rotates together |

## Action items

1. Staging smoke: revoke tenant share → mirror `CANCELLED`, off active schedule, on cancel shelf.
2. After cron deploy: D2 dry-run — confirm only intended tenant inquiries targeted.
3. Keep diagnose scripts out of production image (dev-only).
