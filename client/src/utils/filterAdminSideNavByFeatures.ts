import { tenantNavPathVisibility } from '@shared/tenantNavFeatureCatalog';
import { isSoloOperatorTenant } from '@shared/soloOperator';
import type { AdminSideNavChildLink, AdminSideNavItem, AdminSideNavLink } from '../components/layout/AdminSectionSideNav';

const SOLO_HIDDEN_SIDE_PATHS = ['/admin/team-leaders/household-ledger'];

function isSoloHiddenSidePath(path: string): boolean {
  return SOLO_HIDDEN_SIDE_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** 1인 업체 — 팀장 가계부 조회만 뺀다. 월정산표는 플랜 잠금으로 남긴다. */
export function hideSoloOperatorSideNav(
  items: AdminSideNavItem[],
  enabledModules: readonly string[] | null,
): AdminSideNavItem[] {
  if (!enabledModules || !isSoloOperatorTenant(enabledModules)) return items;
  const out: AdminSideNavItem[] = [];
  for (const item of items) {
    if (item.type === 'link') {
      if (!isSoloHiddenSidePath(item.to)) out.push(item);
      continue;
    }
    const children = item.children.filter((child) => !isSoloHiddenSidePath(child.to));
    if (children.length > 0) out.push({ ...item, children });
  }
  return out;
}

function withLock(
  item: AdminSideNavLink | AdminSideNavChildLink,
  plan: string | null | undefined,
  enabledModules: readonly string[] | null,
): AdminSideNavLink | AdminSideNavChildLink | null {
  const vis = tenantNavPathVisibility(item.to, plan, enabledModules);
  if (vis.state === 'hidden') return null;
  if (vis.state === 'locked' && vis.requiredPlanLabel) {
    return { ...item, lockedPlanLabel: `${vis.requiredPlanLabel}부터` };
  }
  return item;
}

export function filterAdminSideNavItems(
  items: AdminSideNavItem[],
  enabledModules: readonly string[] | null,
  plan: string | null = null,
): AdminSideNavItem[] {
  if (!enabledModules) return items;
  const out: AdminSideNavItem[] = [];
  for (const item of items) {
    if (item.type === 'link') {
      const next = withLock(item, plan, enabledModules);
      if (next) out.push(next as AdminSideNavLink);
      continue;
    }
    const children: AdminSideNavChildLink[] = [];
    for (const child of item.children) {
      const next = withLock(child, plan, enabledModules);
      if (next) children.push(next as AdminSideNavChildLink);
    }
    if (children.length > 0) out.push({ ...item, children });
  }
  return out;
}
