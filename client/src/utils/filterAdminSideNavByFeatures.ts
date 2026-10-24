import { canShowTenantNavPath } from '@shared/tenantNavFeatureCatalog';
import { isSoloOperatorTenant } from '@shared/soloOperator';
import type { AdminSideNavItem } from '../components/layout/AdminSectionSideNav';

const SOLO_HIDDEN_SIDE_PATHS = [
  '/admin/team-leaders/payroll',
  '/admin/team-leaders/household-ledger',
];

function isSoloHiddenSidePath(path: string): boolean {
  return SOLO_HIDDEN_SIDE_PATHS.some((prefix) => path === prefix || path.startsWith(`${prefix}/`));
}

/** 1인 업체 — 월정산표·팀장 가계부 조회는 빼고, 본인 가계부는 GNB로 둔다. */
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

export function filterAdminSideNavItems(
  items: AdminSideNavItem[],
  enabledModules: readonly string[] | null,
): AdminSideNavItem[] {
  if (!enabledModules) return items;
  const out: AdminSideNavItem[] = [];
  for (const item of items) {
    if (item.type === 'link') {
      if (canShowTenantNavPath(item.to, enabledModules)) out.push(item);
      continue;
    }
    const children = item.children.filter((child) => canShowTenantNavPath(child.to, enabledModules));
    if (children.length > 0) {
      out.push({ ...item, children });
    }
  }
  return out;
}
