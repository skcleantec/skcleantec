# PlatformOps — First Maestro run

**Run:** 2026-09-01 11:40 KST

## Features audited

### 1. Platform partner promo (`platform-partner-promo`)

| Check | Status |
|-------|--------|
| Platform admin UI (`/platform/*`) | ✅ manages promos globally |
| Per-tenant `mod_*` gate | N/A — **platform-wide** promo by audience, not tenant module |
| Team API `GET /platform-promos/active` | ✅ role → `tenant_staff` / `external_partner` |
| Cache-Control no-store | ✅ WebView refresh |
| Admin preview `/api/admin/platform-promos` | ✅ |

**Ops:** Enable promo rows in platform DB; set `showOnMobile` / `showOnDesktop`; upload banner image. No per-tenant toggle required unless product adds it later.

### 2. Staff app manifest (`STAFF_APP_*` Railway vars)

| Variable | Purpose |
|----------|---------|
| `STAFF_APP_LATEST_VERSION_CODE` | Latest Play version |
| `STAFF_APP_MIN_VERSION_CODE` | Force-update threshold |
| `STAFF_APP_LATEST_VERSION_NAME` | Display |
| `STAFF_APP_RELEASE_NOTES` | Modal copy |

**Ops:** Bump vars on each staff app Play release (same pattern as `TELECRM_APP_*` for marketer app).

### 3. TeleCRM Play v30/v31

- Docs updated in tree; confirm **Railway staging + production** `TELECRM_APP_*` 6 vars match shipped AAB (per `telecrm-android-release.mdc`).

## Gaps

1. **No usage meter** for promos (impressions/clicks) — acceptable v1; document if analytics needed later.
2. **Staff app manifest** not exposed in platform UI — env-only; consider platform settings page long-term.

## Billing impact

- None for promo display or in-app update gate.

## Recommended changes

_None blocking._ After merge: update Railway env for staff/telecrm version codes when Play ships.
