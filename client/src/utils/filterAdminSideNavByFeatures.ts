import { canShowTenantNavPath } from '@shared/tenantNavFeatureCatalog';
import type { AdminSideNavItem } from '../components/layout/AdminSectionSideNav';

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
