/** 타업체 /team 화면별 홍보 배너 노출 메뉴 */

export type PlatformPromoTeamMenu = 'dashboard' | 'assignments' | 'schedule';

export const PLATFORM_PROMO_TEAM_MENUS: readonly {
  id: PlatformPromoTeamMenu;
  label: string;
  path: string;
}[] = [
  { id: 'dashboard', label: '대시보드', path: '/team/dashboard' },
  { id: 'assignments', label: '접수목록', path: '/team/assignments' },
  { id: 'schedule', label: '스케줄', path: '/team/schedule' },
] as const;

export type PlatformPromoTeamMenuFlags = {
  showOnTeamDashboard?: boolean;
  showOnTeamAssignments?: boolean;
  showOnTeamSchedule?: boolean;
};

export function platformPromoTeamMenuFromPath(pathname: string): PlatformPromoTeamMenu | null {
  if (pathname === '/team/dashboard') return 'dashboard';
  if (pathname === '/team/assignments') return 'assignments';
  if (pathname === '/team/schedule') return 'schedule';
  return null;
}

export function promoVisibleOnTeamMenu(item: PlatformPromoTeamMenuFlags, menu: PlatformPromoTeamMenu): boolean {
  if (menu === 'dashboard') return item.showOnTeamDashboard !== false;
  if (menu === 'assignments') return item.showOnTeamAssignments !== false;
  return item.showOnTeamSchedule !== false;
}

export function formatPlatformPromoTeamMenus(item: PlatformPromoTeamMenuFlags): string {
  const labels = PLATFORM_PROMO_TEAM_MENUS.filter((m) => promoVisibleOnTeamMenu(item, m.id)).map((m) => m.label);
  return labels.length > 0 ? labels.join(' · ') : '—';
}
