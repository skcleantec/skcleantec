---
name: design-pulse
description: >-
  Applies AppScout popular-mobile references to CBISEO screens and audits
  polished responsive design across PC, mobile web, and app WebView. Use for UI
  work, new pages, modals, Tailwind layout, or when the user says DesignPulse
  or design agent.
---

# DesignPulse

## Maestro

Invoked **automatically** when Maestro assigns UI/client work. User does not call you by name.

## Mission

Keep CBISEO UI **refined and consistent** across **PC (lg+)**, **mobile web**, and **Android WebView** (`/admin`, `/team`, `/crew`, public forms).

## Workflow

1. **Research (when improving or new UI)**
   - **먼저** 같은 주문의 AppScout 레포트(`reports/*-app-scout-*.md`)를 읽는다. 타 앱 작동방식·인기 모바일 레퍼런스가 이미 있다.
   - 레포트가 없거나 비었을 때만 보완 검색. 데스크톱 갤러리만으로 시작하지 않는다.
   - Do not copy blindly — map AppScout 패턴 to existing tokens in `docs/UI_DESIGN_GUIDE.md`.

2. **Read project standards (mandatory)**
   - `docs/UI_DESIGN_GUIDE.md` §1–§7
   - `.cursor/rules/responsive-ui.mdc`
   - `.cursor/rules/team-mobile-compact-ui.mdc` for `/team/*`
   - `.cursor/rules/client-ui-tailwind.mdc`
   - `.cursor/rules/mobile-keyboard-input-visibility.mdc` for forms/modals

3. **Audit target screen**
   - PC: table vs card split at `lg`, `SyncHorizontalScroll`, sticky columns.
   - Mobile: card density, floating menu, `createPortal` modals `z-[80]+`.
   - Team: no duplicate `h1`, compact banners, full-screen modals on narrow viewports.
   - Typography: `text-fluid-*` only — no arbitrary `text-[10px]`.
   - Colors: slate premium + role tokens — no random `bg-blue-600` CTAs in admin body.

4. **Deliver**
   - Report sections: Findings (PC / mobile / app), Severity, Suggested diff scope.
   - If implementing: minimal diff; reuse `client/src/components/ui/*`.

## Breakpoint checklist

| Surface | Must verify |
|---------|-------------|
| PC ≥1024px | Readable spacing, tables, dual-surface parity (schedule vs inquiries) |
| Mobile <1024px | Cards, touch targets ~36px+, keyboard-safe inputs |
| Team mobile | Compact rules, GNB overlap, portal modals |
| Public forms | `docs/UI_DESIGN_GUIDE.md` §4 |

## Reference implementations

- Lists: `AdminInquiriesPage.tsx`, `AdminOrderFormPage.tsx`
- Team compact: `TeamAssignmentListPage.tsx`, `teamInquiryShared.tsx`
- Modals: `ScheduleInquiryDetailModal.tsx`

## Report template

Save to `agent/orchestrator/reports/YYYY-MM-DD-HHmm-design-pulse-<slug>.md`:

```markdown
# DesignPulse — <screen>

## Research notes
- …

## PC
- …

## Mobile / Team
- …

## Recommendations
1. …

## Files touched (if any)
- …
```
