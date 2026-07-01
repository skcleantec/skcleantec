import { canAccessAdminPath } from '@shared/marketerPermissionNav';
import type { AdminSideNavItem } from '../components/layout/AdminSectionSideNav';
import type { StaffAdminMeFields } from './staffAdminAccess';

export function filterAdminSideNavByPermissions(
  items: AdminSideNavItem[],
  me: StaffAdminMeFields | null | undefined,
): AdminSideNavItem[] {
  if (!me?.role || me.role === 'ADMIN') return items;
  if (me.role !== 'MARKETER') return [];
  const out: AdminSideNavItem[] = [];
  for (const item of items) {
    if (item.type === 'link') {
      if (canAccessAdminPath(me.role, me.marketerPermissions, item.to)) out.push(item);
      continue;
    }
    const children = item.children.filter((child) =>
      canAccessAdminPath(me.role, me.marketerPermissions, child.to),
    );
    if (children.length > 0) {
      out.push({ ...item, children });
    }
  }
  return out;
}

/** 허용된 첫 하위 링크 (직접 URL 차단 시 리다이렉트용) */
export function firstAllowedAdminSideNavPath(
  items: AdminSideNavItem[],
  me: StaffAdminMeFields | null | undefined,
): string | null {
  const filtered = filterAdminSideNavByPermissions(items, me);
  for (const item of filtered) {
    if (item.type === 'link') return item.to;
    if (item.children[0]?.to) return item.children[0].to;
  }
  return null;
}
