import type { TeamNavIconType } from './TeamNavIcons';

export type TeamMobileBottomNavTab = {
  id: string;
  path: string;
  icon: TeamNavIconType;
  shortLabelId:
    | 'team.layout.nav.dashboardShort'
    | 'team.layout.nav.assignmentsShort'
    | 'team.layout.nav.schedule'
    | 'team.layout.nav.householdLedger'
    | 'team.layout.nav.messages';
  emphasize?: boolean;
  badgeCount?: number;
};

export function isTeamMobileBottomNavHidden(pathname: string): boolean {
  return (
    pathname.startsWith('/team/pre-clean/') ||
    pathname.startsWith('/team/post-clean/') ||
    pathname.startsWith('/team/inspection/')
  );
}

export function isTeamMobileBottomNavTabActive(pathname: string, path: string): boolean {
  if (path === '/team/dashboard') {
    return pathname === '/team/dashboard' || pathname === '/team' || pathname === '/team/';
  }
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** 1 홈 · 2 배정 · 3 스케줄(강조) · 4 가계부 · 5 메시지 — 타업체는 가계부 제외 */
export function buildTeamMobileBottomNavTabs(opts: {
  showHouseholdLedger: boolean;
  newAssignmentCount: number;
  unreadCount: number;
}): TeamMobileBottomNavTab[] {
  const tabs: TeamMobileBottomNavTab[] = [
    {
      id: 'dashboard',
      path: '/team/dashboard',
      icon: 'dashboard',
      shortLabelId: 'team.layout.nav.dashboardShort',
    },
    {
      id: 'assignments',
      path: '/team/assignments',
      icon: 'assignments',
      shortLabelId: 'team.layout.nav.assignmentsShort',
      badgeCount: opts.newAssignmentCount,
    },
    {
      id: 'schedule',
      path: '/team/schedule',
      icon: 'schedule',
      shortLabelId: 'team.layout.nav.schedule',
      emphasize: true,
    },
  ];

  if (opts.showHouseholdLedger) {
    tabs.push({
      id: 'household-ledger',
      path: '/team/household-ledger',
      icon: 'household-ledger',
      shortLabelId: 'team.layout.nav.householdLedger',
    });
  }

  tabs.push({
    id: 'messages',
    path: '/team/messages',
    icon: 'messages',
    shortLabelId: 'team.layout.nav.messages',
    badgeCount: opts.unreadCount,
  });

  return tabs;
}
