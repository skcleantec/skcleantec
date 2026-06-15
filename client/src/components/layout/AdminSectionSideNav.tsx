import { useCallback, useEffect, useState } from 'react';
import { NavLink, matchPath, useLocation } from 'react-router-dom';
import { notifyAdminSectionSideNavLayoutChange } from '../../utils/adminSectionSideNavLayout';

function ChevronLeftIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  );
}

export type AdminSideNavChildLink = {
  to: string;
  label: string;
  end?: boolean;
  title?: string;
};

export type AdminSideNavLink = {
  type: 'link';
  to: string;
  label: string;
  end?: boolean;
  title?: string;
  /** 미확인 건수 등 — 0이면 숨김 */
  badge?: number;
};

export type AdminSideNavGroup = {
  type: 'group';
  label: string;
  children: AdminSideNavChildLink[];
};

export type AdminSideNavItem = AdminSideNavLink | AdminSideNavGroup;

function isPathActive(pathname: string, to: string, end?: boolean) {
  return Boolean(matchPath({ path: to, end: end ?? false }, pathname));
}

function topLinkClassName(isActive: boolean) {
  return [
    'block min-w-0 truncate rounded px-1.5 py-1 lg:py-1.5',
    'text-[clamp(0.625rem,0.55rem+0.28vw,0.8125rem)] leading-snug transition-colors',
    isActive ? 'bg-blue-50 font-medium text-blue-800' : 'text-gray-800 hover:bg-gray-50',
  ].join(' ');
}

function childLinkClassName(isActive: boolean) {
  return [
    'block min-w-0 truncate rounded py-1 pl-1 pr-0.5 lg:py-1.5',
    'text-[clamp(0.6rem,0.5rem+0.24vw,0.75rem)] leading-snug transition-colors',
    isActive ? 'bg-blue-50 font-medium text-blue-800' : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
  ].join(' ');
}

/** PC 사이드 너비(px) — 접이식·고정 폭 공통 */
export const ADMIN_SECTION_SIDE_NAV_WIDTH_PX = 170;

/** PC 사이드 프레임 — 폭·패딩 반응형 (섹션 레이아웃과 함께 사용) */
export const adminSectionSideNavAsideClassName =
  'hidden lg:block w-[170px] shrink-0 self-start sticky top-0 min-w-0';


export const adminSectionSideNavFrameClassName =
  'rounded-md border border-gray-200 bg-white p-1.5 shadow-sm lg:p-2 xl:p-2.5';

export const adminSectionSideNavTitleClassName =
  'mb-1.5 truncate px-1.5 text-[clamp(0.6rem,0.52rem+0.22vw,0.75rem)] font-semibold text-gray-900 lg:mb-2';

type Props = {
  items: AdminSideNavItem[];
  'aria-label': string;
  className?: string;
};

/** PC(lg+) 섹션 왼쪽 프레임 — 하위 메뉴 / 하위·하위 메뉴 계층 */
export function AdminSectionSideNav({ items, 'aria-label': ariaLabel, className = '' }: Props) {
  const { pathname } = useLocation();

  return (
    <nav aria-label={ariaLabel} className={className}>
      <ul className="space-y-2 lg:space-y-2.5">
        {items.map((item) => {
          if (item.type === 'link') {
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  title={
                    item.badge && item.badge > 0
                      ? `${item.title ?? item.label} (미확인 ${item.badge}건)`
                      : (item.title ?? item.label)
                  }
                  className={({ isActive }) => topLinkClassName(isActive)}
                >
                  <span className="inline-flex min-w-0 items-center gap-1">
                    <span className="truncate">{item.label}</span>
                    {item.badge && item.badge > 0 ? (
                      <span className="shrink-0 rounded-full bg-red-600 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-white">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    ) : null}
                  </span>
                </NavLink>
              </li>
            );
          }

          const groupActive = item.children.some((c) => isPathActive(pathname, c.to, c.end));
          return (
            <li key={item.label}>
              <div
                className={[
                  'truncate px-1.5 text-[clamp(0.58rem,0.5rem+0.2vw,0.6875rem)] font-semibold tracking-tight',
                  groupActive ? 'text-blue-800' : 'text-gray-500',
                ].join(' ')}
                title={item.label}
              >
                {item.label}
              </div>
              <ul className="mt-1 space-y-px border-l border-gray-200 ml-1.5 pl-1 lg:mt-1.5 lg:ml-2 lg:pl-1.5">
                {item.children.map((child) => (
                    <li key={child.to}>
                      <NavLink
                        to={child.to}
                        end={child.end}
                        title={child.title ?? child.label}
                        className={({ isActive }) => childLinkClassName(isActive)}
                      >
                        <span className="text-gray-400" aria-hidden>
                          −
                        </span>{' '}
                        {child.label}
                      </NavLink>
                    </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function readCollapsedFromStorage(storageKey: string | undefined): boolean {
  if (!storageKey || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(storageKey) === '1';
  } catch {
    return false;
  }
}

type CollapsibleProps = {
  title: string;
  items: AdminSideNavItem[];
  'aria-label': string;
  /** 접힘 상태를 브라우저에 기억할 때 사용 */
  collapseStorageKey?: string;
};

/** PC(lg+) 접이식 섹션 사이드 — 기본 펼침, 화살표로 왼쪽 슬라이드 접기·펼치기 */
export function AdminCollapsibleSectionSideNav({
  title,
  items,
  'aria-label': ariaLabel,
  collapseStorageKey,
}: CollapsibleProps) {
  const [collapsed, setCollapsed] = useState(() => readCollapsedFromStorage(collapseStorageKey));

  useEffect(() => {
    notifyAdminSectionSideNavLayoutChange();
  }, []);

  const setCollapsedPersisted = useCallback(
    (next: boolean) => {
      setCollapsed(next);
      notifyAdminSectionSideNavLayoutChange();
      if (!collapseStorageKey) return;
      try {
        window.localStorage.setItem(collapseStorageKey, next ? '1' : '0');
      } catch {
        /* ignore */
      }
    },
    [collapseStorageKey],
  );

  const toggle = () => setCollapsedPersisted(!collapsed);

  return (
    <div
      className={[
        'relative hidden lg:block shrink-0 self-start sticky top-0 z-[5] min-w-0',
        'transition-[width] duration-300 ease-in-out motion-reduce:transition-none',
        collapsed ? 'w-7' : 'w-[170px]',
      ].join(' ')}
    >
      <div
        className={[
          'overflow-hidden transition-[width] duration-300 ease-in-out motion-reduce:transition-none',
          collapsed ? 'w-0' : 'w-[170px]',
        ].join(' ')}
        aria-hidden={collapsed}
      >
        <aside className="w-[170px] shrink-0 min-w-0">
          <div className={adminSectionSideNavFrameClassName}>
            <p className={adminSectionSideNavTitleClassName} title={title}>
              {title}
            </p>
            <AdminSectionSideNav items={items} aria-label={ariaLabel} />
          </div>
        </aside>
      </div>
      <button
        type="button"
        onClick={toggle}
        className={[
          'absolute top-1 z-10 flex h-8 w-7 items-center justify-center',
          'border border-gray-200 bg-white text-gray-600 shadow-sm',
          'hover:bg-gray-50 active:bg-gray-100',
          collapsed
            ? 'left-0 rounded-r-md border-l-0'
            : 'left-[170px] -translate-x-full rounded-r-md border-l-0',
        ].join(' ')}
        aria-label={collapsed ? '사이드 메뉴 펼치기' : '사이드 메뉴 접기'}
        aria-expanded={!collapsed}
      >
        {collapsed ? <ChevronRightIcon className="h-4 w-4" /> : <ChevronLeftIcon className="h-4 w-4" />}
      </button>
    </div>
  );
}
