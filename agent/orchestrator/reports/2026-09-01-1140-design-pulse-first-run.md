# DesignPulse — First Maestro run

**Focus:** Team schedule/dashboard, staff app update UI, platform promo carousel  
**Run:** 2026-09-01 11:40 KST

## Research notes

- Current SaaS pattern: **non-blocking optional updates** + **blocking required updates** with Play In-App Update — matches `StaffAppUpdateBanner` required (fullscreen) vs optional (bottom sheet) split.
- Team mobile: **compact cards**, **portal modals** above GNB — project standard maintained.

## PC (lg+)

| Item | Status |
|------|--------|
| Platform promo `showOnDesktop` filter | ✅ |
| Admin/team layouts + promo slots | ✅ (TeamLayout imports carousel) |
| Table/card split on team schedule | ✅ existing pattern |

## Mobile / Team / WebView

| Item | Status |
|------|--------|
| `StaffAppUpdateBanner` required modal | ✅ `createPortal`, `z-[80]`, `modal-mobile-fullscreen-panel` |
| Optional update banner | ✅ bottom sheet pattern |
| Button hover/focus/disabled | ✅ on primary CTAs |
| Typography | ✅ `text-fluid-*` |
| Team schedule date labels | ✅ KST helpers — fixes timezone display bug |
| Platform promo mobile slides | ✅ `showOnMobile` + cache-bust key on `updatedAt` + image URL |

## Recommendations

1. **Optional update sheet vs floating menu** — GNB hamburger uses `z-[118]`; update modal `z-[80]`. OK today; if optional banner is `fixed` bottom, confirm it doesn't cover safe-area home indicator on iOS WebView (minor).
2. **Required update copy** — Clear; keep release notes from `STAFF_APP_RELEASE_NOTES` env concise on mobile.
3. No new arbitrary palette — slate/white cards consistent with UI guide.

## Files touched (audit only)

- `client/src/components/staff/StaffAppUpdateBanner.tsx`
- `client/src/components/platformPromo/PlatformPromoDisplay.tsx`
- `client/src/pages/team/TeamSchedulePage.tsx`, `TeamDashboardPage.tsx`
