import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { TeamNavIcon } from './TeamNavIcons';
import {
  buildTeamMobileBottomNavTabs,
  isTeamMobileBottomNavHidden,
  isTeamMobileBottomNavTabActive,
  type TeamMobileBottomNavTab,
} from './teamMobileBottomNav.config';
import { teamBiPlain } from '../../i18n/team/teamI18n';
import { TEAM_MOBILE_BOTTOM_NAV_Z } from '../../utils/staffAppSafeArea';
import { TEAM_MOBILE_BOTTOM_NAV_BADGE_CLASS } from './mobileStaffDockStyles';

type Props = {
  teamTo: (path: string) => string;
  showHouseholdLedger: boolean;
  newAssignmentCount: number;
  unreadCount: number;
};

const bottomNavBadgeClass = TEAM_MOBILE_BOTTOM_NAV_BADGE_CLASS;

function formatBadge(count: number): string {
  return count > 99 ? '99+' : String(count);
}

function tabInnerClass(tab: TeamMobileBottomNavTab, isActive: boolean): string {
  if (isActive) return 'team-mobile-bottom-nav-tab-active';
  if (tab.emphasize) return 'team-mobile-bottom-nav-tab-feature';
  return 'team-mobile-bottom-nav-tab-idle';
}

function tabIconClass(isActive: boolean, emphasize?: boolean): string {
  if (isActive) return 'team-mobile-bottom-nav-tab-icon team-mobile-bottom-nav-tab-icon-active';
  if (emphasize) return 'team-mobile-bottom-nav-tab-icon team-mobile-bottom-nav-tab-icon-feature';
  return 'team-mobile-bottom-nav-tab-icon';
}

function tabLabelClass(isActive: boolean, emphasize?: boolean): string {
  if (isActive) return 'team-mobile-bottom-nav-tab-label team-mobile-bottom-nav-tab-label-active';
  if (emphasize) return 'team-mobile-bottom-nav-tab-label team-mobile-bottom-nav-tab-label-feature';
  return 'team-mobile-bottom-nav-tab-label';
}

function BottomNavTabLink({
  tab,
  teamTo,
  isActive,
}: {
  tab: TeamMobileBottomNavTab;
  teamTo: (path: string) => string;
  isActive: boolean;
}) {
  const label = teamBiPlain(tab.shortLabelId);
  const badge = tab.badgeCount && tab.badgeCount > 0 ? formatBadge(tab.badgeCount) : null;

  return (
    <NavLink
      to={teamTo(tab.path)}
      aria-label={badge ? `${label} ${badge}건` : label}
      title={label}
      className="relative flex min-h-[34px] min-w-0 flex-1 touch-manipulation overflow-visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
    >
      {badge ? (
        <span className={`${bottomNavBadgeClass} left-1/2 top-0 -translate-y-0.5 translate-x-[0.625rem]`} aria-hidden>
          {badge}
        </span>
      ) : null}
      <span
        className={`team-mobile-bottom-nav-tab-inner mx-auto flex w-full max-w-[4rem] min-w-0 flex-col items-center justify-center gap-px rounded-full px-1 py-0.5 transition-all duration-200 ${tabInnerClass(tab, isActive)}`}
      >
        <span className={`relative z-[1] flex items-center justify-center overflow-visible transition-colors ${tabIconClass(isActive, tab.emphasize)}`}>
          <TeamNavIcon type={tab.icon} className="h-4 w-4 shrink-0" strokeWidth={1.4} />
        </span>
        <span className={`w-full truncate text-center text-[8px] font-medium leading-none tracking-wide ${tabLabelClass(isActive, tab.emphasize)}`}>
          {label}
        </span>
      </span>
    </NavLink>
  );
}

export function TeamMobileBottomNav({
  teamTo,
  showHouseholdLedger,
  newAssignmentCount,
  unreadCount,
}: Props) {
  const { pathname } = useLocation();

  if (typeof document === 'undefined' || isTeamMobileBottomNavHidden(pathname)) {
    return null;
  }

  const tabs = buildTeamMobileBottomNavTabs({
    showHouseholdLedger,
    newAssignmentCount,
    unreadCount,
  });

  return createPortal(
    <nav
      className={`team-mobile-bottom-nav pointer-events-none fixed inset-x-0 bottom-0 ${TEAM_MOBILE_BOTTOM_NAV_Z} lg:hidden`}
      aria-label={teamBiPlain('team.layout.nav.menuTitle')}
    >
      <div className="team-mobile-bottom-nav-inner pointer-events-auto mx-auto w-full max-w-lg px-5">
        <div className="team-mobile-bottom-nav-glass flex items-center justify-between gap-0.5 rounded-full px-1 py-0.5">
          {tabs.map((tab) => (
            <BottomNavTabLink
              key={tab.id}
              tab={tab}
              teamTo={teamTo}
              isActive={isTeamMobileBottomNavTabActive(pathname, tab.path)}
            />
          ))}
        </div>
      </div>
    </nav>,
    document.body,
  );
}
