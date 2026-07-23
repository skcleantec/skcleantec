import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink, matchPath, useLocation } from 'react-router-dom';
import type { AdminSideNavIconId } from './adminSideNavIcons';
import { AdminSideNavIcon, resolveAdminSideNavIcon } from './adminSideNavIcons';
import { flattenAdminSideNavItems } from '../../utils/flattenAdminSideNavItems';
import { notifyAdminSectionSideNavLayoutChange } from '../../utils/adminSectionSideNavLayout';

export type AdminSideNavChildLink = {
  to: string;
  label: string;
  end?: boolean;
  title?: string;
  icon?: AdminSideNavIconId;
};

export type AdminSideNavLink = {
  type: 'link';
  to: string;
  label: string;
  end?: boolean;
  title?: string;
  icon?: AdminSideNavIconId;
  /** 미확인 건수 등 — 0이면 숨김 */
  badge?: number;
};

export type AdminSideNavGroup = {
  type: 'group';
  label: string;
  children: AdminSideNavChildLink[];
};

export type AdminSideNavItem = AdminSideNavLink | AdminSideNavGroup;

/** PC 사이드 펼침 폭(px) */
export const ADMIN_SECTION_SIDE_NAV_WIDTH_PX = 200;

/** PC 사이드 접힘 폭(px) — 아이콘 레일 */
export const ADMIN_SECTION_SIDE_NAV_COLLAPSED_WIDTH_PX = 56;

function isPathActive(pathname: string, to: string, end?: boolean): boolean {
  return Boolean(matchPath({ path: to, end: end ?? false }, pathname));
}

function PanelCollapseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path strokeLinecap="round" d="M9 4v16" />
    </svg>
  );
}

function linkTitle(label: string, title?: string, badge?: number): string {
  if (badge && badge > 0) {
    return `${title ?? label} (미확인 ${badge > 99 ? '99+' : badge}건)`;
  }
  return title ?? label;
}

function topLinkClass(isActive: boolean): string {
  return [
    'group relative flex min-w-0 items-center gap-2 rounded-xl px-2.5 py-1.5',
    'text-[clamp(0.625rem,0.55rem+0.28vw,0.8125rem)] leading-snug transition-colors',
    isActive
      ? 'bg-white/10 font-medium text-white shadow-sm ring-1 ring-inset ring-white/15'
      : 'text-slate-200 hover:bg-white/10 hover:text-white',
  ].join(' ');
}

function childLinkClass(isActive: boolean): string {
  return [
    'group relative flex min-w-0 items-center gap-1.5 rounded-lg py-1 pl-1 pr-1.5',
    'text-[clamp(0.6rem,0.5rem+0.24vw,0.75rem)] leading-snug transition-colors',
    isActive
      ? 'font-medium text-white'
      : 'text-slate-300 hover:text-slate-50',
  ].join(' ');
}

function collapsedLinkClass(isActive: boolean): string {
  return [
    'relative mx-auto flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
    isActive
      ? 'bg-white/10 text-white ring-1 ring-inset ring-white/15'
      : 'text-slate-300 hover:bg-white/10 hover:text-white',
  ].join(' ');
}

function NavBadge({ count, collapsed }: { count: number; collapsed: boolean }) {
  if (count <= 0) return null;
  const label = count > 99 ? '99+' : String(count);
  if (collapsed) {
    return (
      <span
        className="absolute right-1 top-1 h-2 w-2 rounded-full bg-red-500 ring-2 ring-slate-900"
        aria-label={`미확인 ${label}건`}
      />
    );
  }
  return (
    <span className="ml-auto shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[9px] font-semibold tabular-nums text-white">
      {label}
    </span>
  );
}

function ActiveBar() {
  return (
    <span
      className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-blue-400"
      aria-hidden
    />
  );
}

/** 펼침 — 대(섹션 제목)·중(group/1depth link)·소(group child) 계층 */
function HierarchicalNavList({
  items,
  ariaLabel,
}: {
  items: AdminSideNavItem[];
  ariaLabel: string;
}) {
  const { pathname } = useLocation();

  return (
    <nav aria-label={ariaLabel} className="min-w-0">
      <ul className="space-y-1 px-1.5">
        {items.map((item) => {
          if (item.type === 'link') {
            const icon = item.icon ?? resolveAdminSideNavIcon(item.to);
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.end}
                  title={linkTitle(item.label, item.title, item.badge)}
                  className={({ isActive }) => topLinkClass(isActive)}
                >
                  {({ isActive }) => (
                    <>
                      {isActive ? <ActiveBar /> : null}
                      <AdminSideNavIcon id={icon} className="h-4 w-4 shrink-0 opacity-90" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      <NavBadge count={item.badge ?? 0} collapsed={false} />
                    </>
                  )}
                </NavLink>
              </li>
            );
          }

          const groupActive = item.children.some((c) => isPathActive(pathname, c.to, c.end));
          return (
            <li key={item.label} className="pt-1">
              <div
                className={[
                  'truncate px-2.5 pb-1 text-[clamp(0.58rem,0.5rem+0.2vw,0.6875rem)] font-semibold tracking-tight',
                  groupActive ? 'text-white' : 'text-slate-300',
                ].join(' ')}
                title={item.label}
              >
                {item.label}
              </div>
              <ul className="ml-2 space-y-0.5 border-l border-slate-700/80 pl-2">
                {item.children.map((child) => {
                  const icon = child.icon ?? resolveAdminSideNavIcon(child.to);
                  return (
                    <li key={child.to}>
                      <NavLink
                        to={child.to}
                        end={child.end}
                        title={linkTitle(child.label, child.title)}
                        className={({ isActive }) => childLinkClass(isActive)}
                      >
                        {({ isActive }) => (
                          <>
                            <AdminSideNavIcon
                              id={icon}
                              className={[
                                'h-3.5 w-3.5 shrink-0',
                                isActive ? 'text-blue-300 opacity-100' : 'text-slate-500 opacity-80',
                              ].join(' ')}
                            />
                            <span className="min-w-0 flex-1 truncate">{child.label}</span>
                          </>
                        )}
                      </NavLink>
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** 접힘 — leaf 링크만 아이콘 레일 */
function CollapsedIconRail({ items, ariaLabel }: { items: AdminSideNavItem[]; ariaLabel: string }) {
  const flatLinks = useMemo(() => flattenAdminSideNavItems(items), [items]);

  return (
    <nav aria-label={ariaLabel} className="min-w-0">
      <ul className="space-y-1 px-1.5">
        {flatLinks.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.end}
              title={linkTitle(link.label, link.title, link.badge)}
              className={({ isActive }) => collapsedLinkClass(isActive)}
            >
              <AdminSideNavIcon id={link.icon} />
              <NavBadge count={link.badge ?? 0} collapsed />
            </NavLink>
          </li>
        ))}
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
  /** 접힘 상태를 브라우저에 기억할 때 사용 — 최초 진입은 펼침 */
  collapseStorageKey?: string;
};

/** PC(lg+) 네이비 접이식 섹션 사이드 — 펼침: 계층 메뉴 / 접힘: 아이콘 레일 */
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

  const widthPx = collapsed
    ? ADMIN_SECTION_SIDE_NAV_COLLAPSED_WIDTH_PX
    : ADMIN_SECTION_SIDE_NAV_WIDTH_PX;

  return (
    <aside
      className={[
        'hidden lg:flex shrink-0 self-start sticky top-6 z-[5] min-w-0 flex-col',
        'transition-[width] duration-300 ease-in-out motion-reduce:transition-none',
      ].join(' ')}
      style={{ width: widthPx }}
      aria-label={ariaLabel}
    >
      <div
        className={[
          'flex max-h-[calc(100dvh-6.5rem)] min-h-[12rem] flex-col overflow-hidden',
          'rounded-2xl border border-slate-800 bg-slate-900 shadow-lg shadow-slate-900/20',
        ].join(' ')}
      >
        {!collapsed ? (
          <div className="border-b border-slate-800 px-3 py-2.5">
            <p
              className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-200"
              title={title}
            >
              {title}
            </p>
          </div>
        ) : (
          <div className="flex h-10 items-center justify-center border-b border-slate-800" aria-hidden>
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain py-2 [-webkit-overflow-scrolling:touch]">
          {collapsed ? (
            <CollapsedIconRail items={items} ariaLabel={ariaLabel} />
          ) : (
            <HierarchicalNavList items={items} ariaLabel={ariaLabel} />
          )}
        </div>

        <div className="border-t border-slate-800 p-1.5">
          <button
            type="button"
            onClick={() => setCollapsedPersisted(!collapsed)}
            className={[
              'flex w-full items-center rounded-xl text-slate-300 transition-colors',
              'hover:bg-white/10 hover:text-white active:bg-white/10',
              collapsed ? 'justify-center py-2.5' : 'gap-2 px-2.5 py-2',
            ].join(' ')}
            aria-label={collapsed ? '사이드 메뉴 펼치기' : '사이드 메뉴 접기'}
            aria-expanded={!collapsed}
          >
            <PanelCollapseIcon className="h-[18px] w-[18px] shrink-0" />
            {!collapsed ? (
              <span className="text-[11px] font-medium text-slate-200">메뉴 접기</span>
            ) : null}
          </button>
        </div>
      </div>
    </aside>
  );
}
