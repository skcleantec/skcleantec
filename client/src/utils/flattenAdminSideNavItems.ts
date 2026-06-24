import type { AdminSideNavIconId } from '../components/layout/adminSideNavIcons';
import { resolveAdminSideNavIcon } from '../components/layout/adminSideNavIcons';
import type { AdminSideNavItem } from '../components/layout/AdminSectionSideNav';

export type AdminSideNavFlatLink = {
  to: string;
  label: string;
  end?: boolean;
  title?: string;
  badge?: number;
  icon: AdminSideNavIconId;
};

/** group 헤더 없이 link·group 자식을 하나의 세로 목록으로 펼침 */
export function flattenAdminSideNavItems(items: AdminSideNavItem[]): AdminSideNavFlatLink[] {
  const out: AdminSideNavFlatLink[] = [];
  for (const item of items) {
    if (item.type === 'link') {
      out.push({
        to: item.to,
        label: item.label,
        end: item.end,
        title: item.title ?? item.label,
        badge: item.badge,
        icon: item.icon ?? resolveAdminSideNavIcon(item.to),
      });
      continue;
    }
    for (const child of item.children) {
      out.push({
        to: child.to,
        label: child.label,
        end: child.end,
        title: child.title ?? child.label,
        icon: child.icon ?? resolveAdminSideNavIcon(child.to),
      });
    }
  }
  return out;
}
