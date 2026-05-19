import type { AdminSideNavItem } from '../components/layout/AdminSectionSideNav';

/** 광고비(/admin/advertising/*) — PC 사이드·모바일 가로 탭 공통 정의 */
export function getAdminAdvertisingNavItems(isAdmin: boolean): AdminSideNavItem[] {
  const items: AdminSideNavItem[] = [
    { type: 'link', to: '/admin/advertising', end: true, label: '광고비', title: '광고비 집계' },
  ];
  if (isAdmin) {
    items.push({
      type: 'link',
      to: '/admin/advertising/settings',
      label: '설정',
      title: '광고비 정산 설정',
    });
  }
  return items;
}
