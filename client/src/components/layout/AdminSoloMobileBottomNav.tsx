import { createPortal } from 'react-dom';
import { NavLink, useLocation } from 'react-router-dom';
import { TeamNavIcon, type TeamNavIconType } from './TeamNavIcons';
import { TEAM_MOBILE_BOTTOM_NAV_Z } from '../../utils/staffAppSafeArea';

const TABS: { id: string; path: string; label: string; icon: TeamNavIconType; emphasize?: boolean }[] = [
  { id: 'inquiries', path: '/admin/inquiries', label: '접수', icon: 'assignments' },
  { id: 'schedule', path: '/admin/schedule', label: '스케줄', icon: 'schedule' },
  { id: 'ledger', path: '/admin/my-ledger', label: '가계부', icon: 'household-ledger', emphasize: true },
  { id: 'messages', path: '/admin/messages', label: '메시지', icon: 'messages' },
];

function isActive(pathname: string, path: string): boolean {
  return pathname === path || pathname.startsWith(`${path}/`);
}

/** 1인 업체 관리자 모바일 하단. 가계부를 스케줄 옆 고정 탭으로 둔다. */
export function AdminSoloMobileBottomNav() {
  const { pathname } = useLocation();
  if (typeof document === 'undefined') return null;

  return createPortal(
    <nav
      className={`team-mobile-bottom-nav pointer-events-none fixed inset-x-0 bottom-0 ${TEAM_MOBILE_BOTTOM_NAV_Z} lg:hidden`}
      aria-label="바로가기"
    >
      <div className="team-mobile-bottom-nav-inner pointer-events-auto mx-auto w-full max-w-lg px-5">
        <div className="team-mobile-bottom-nav-glass flex items-center justify-between gap-0.5 rounded-full px-1 py-0.5">
          {TABS.map((tab) => {
            const active = isActive(pathname, tab.path);
            const inner = active
              ? 'team-mobile-bottom-nav-tab-active'
              : tab.emphasize
                ? 'team-mobile-bottom-nav-tab-feature'
                : 'team-mobile-bottom-nav-tab-idle';
            const icon = active
              ? 'team-mobile-bottom-nav-tab-icon team-mobile-bottom-nav-tab-icon-active'
              : tab.emphasize
                ? 'team-mobile-bottom-nav-tab-icon team-mobile-bottom-nav-tab-icon-feature'
                : 'team-mobile-bottom-nav-tab-icon';
            const label = active
              ? 'team-mobile-bottom-nav-tab-label team-mobile-bottom-nav-tab-label-active'
              : tab.emphasize
                ? 'team-mobile-bottom-nav-tab-label team-mobile-bottom-nav-tab-label-feature'
                : 'team-mobile-bottom-nav-tab-label';
            return (
              <NavLink
                key={tab.id}
                to={tab.path}
                aria-label={tab.label}
                title={tab.label}
                className="relative flex min-h-9 min-w-0 flex-1 touch-manipulation overflow-visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/35 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
              >
                <span
                  className={`team-mobile-bottom-nav-tab-inner mx-auto flex w-full max-w-[4.5rem] min-w-0 flex-col items-center justify-center gap-px rounded-full px-1 py-0.5 ${inner}`}
                >
                  <span className={`relative z-[1] flex items-center justify-center ${icon}`}>
                    <TeamNavIcon type={tab.icon} className="h-4 w-4 shrink-0" />
                  </span>
                  <span className={`w-full truncate text-center text-fluid-2xs font-medium leading-none ${label}`}>
                    {tab.label}
                  </span>
                </span>
              </NavLink>
            );
          })}
        </div>
      </div>
    </nav>,
    document.body,
  );
}
