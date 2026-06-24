import { useCallback, useEffect, useMemo, useState } from 'react';
import { NavLink } from 'react-router-dom';
import type { AdminSideNavIconId } from './adminSideNavIcons';
import { AdminSideNavIcon } from './adminSideNavIcons';
import { flattenAdminSideNavItems, type AdminSideNavFlatLink } from '../../utils/flattenAdminSideNavItems';
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

function PanelCollapseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path strokeLinecap="round" d="M9 4v16" />
    </svg>
  );
}

function linkTitle(link: AdminSideNavFlatLink): string {
  if (link.badge && link.badge > 0) {
    return `${link.title ?? link.label} (미확인 ${link.badge}건)`;
  }
  return link.title ?? link.label;
}

function expandedLinkClass(isActive: boolean): string {
  return [
    'group relative flex min-w-0 items-center gap-2.5 rounded-xl px-2.5 py-2',
    'text-[clamp(0.625rem,0.55rem+0.28vw,0.8125rem)] leading-snug transition-colors',
    isActive
      ? 'bg-white/10 font-medium text-white shadow-sm ring-1 ring-inset ring-white/10'
      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
  ].join(' ');
}

function collapsedLinkClass(isActive: boolean): string {
  return [
    'relative mx-auto flex h-10 w-10 items-center justify-center rounded-xl transition-colors',
    isActive
      ? 'bg-white/10 text-white ring-1 ring-inset ring-white/10'
      : 'text-slate-400 hover:bg-white/5 hover:text-slate-200',
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

function FlatNavList({
  links,
  collapsed,
  ariaLabel,
}: {
  links: AdminSideNavFlatLink[];
  collapsed: boolean;
  ariaLabel: string;
}) {
  return (
    <nav aria-label={ariaLabel} className="min-w-0">
      <ul className={collapsed ? 'space-y-1 px-1.5' : 'space-y-0.5 px-1.5'}>
        {links.map((link) => (
          <li key={link.to}>
            <NavLink
              to={link.to}
              end={link.end}
              title={linkTitle(link)}
              className={({ isActive }) =>
                collapsed ? collapsedLinkClass(isActive) : expandedLinkClass(isActive)
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && !collapsed ? (
                    <span
                      className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-blue-500"
                      aria-hidden
                    />
                  ) : null}
                  <AdminSideNavIcon id={link.icon} />
                  {!collapsed ? (
                    <>
                      <span className="min-w-0 truncate">{link.label}</span>
                      <NavBadge count={link.badge ?? 0} collapsed={false} />
                    </>
                  ) : (
                    <NavBadge count={link.badge ?? 0} collapsed />
                  )}
                </>
              )}
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

/** PC(lg+) 네이비 접이식 섹션 사이드 — 펼침: 긴 텍스트 목록 / 접힘: 아이콘 레일 */
export function AdminCollapsibleSectionSideNav({
  title,
  items,
  'aria-label': ariaLabel,
  collapseStorageKey,
}: CollapsibleProps) {
  const [collapsed, setCollapsed] = useState(() => readCollapsedFromStorage(collapseStorageKey));
  const flatLinks = useMemo(() => flattenAdminSideNavItems(items), [items]);

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
        'hidden lg:flex shrink-0 self-start sticky top-2 z-[5] min-w-0 flex-col',
        'transition-[width] duration-300 ease-in-out motion-reduce:transition-none',
      ].join(' ')}
      style={{ width: widthPx }}
      aria-label={ariaLabel}
    >
      <div
        className={[
          'flex max-h-[calc(100vh-7rem)] min-h-[12rem] flex-col overflow-hidden',
          'rounded-2xl border border-slate-800 bg-slate-900 shadow-lg shadow-slate-900/20',
        ].join(' ')}
      >
        {!collapsed ? (
          <div className="border-b border-slate-800 px-3 py-2.5">
            <p
              className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400"
              title={title}
            >
              {title}
            </p>
          </div>
        ) : (
          <div className="flex h-10 items-center justify-center border-b border-slate-800" aria-hidden>
            <span className="h-1.5 w-1.5 rounded-full bg-slate-600" />
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain py-2 [-webkit-overflow-scrolling:touch]">
          <FlatNavList links={flatLinks} collapsed={collapsed} ariaLabel={ariaLabel} />
        </div>

        <div className="border-t border-slate-800 p-1.5">
          <button
            type="button"
            onClick={() => setCollapsedPersisted(!collapsed)}
            className={[
              'flex w-full items-center rounded-xl text-slate-400 transition-colors',
              'hover:bg-white/5 hover:text-slate-200 active:bg-white/10',
              collapsed ? 'justify-center py-2.5' : 'gap-2 px-2.5 py-2',
            ].join(' ')}
            aria-label={collapsed ? '사이드 메뉴 펼치기' : '사이드 메뉴 접기'}
            aria-expanded={!collapsed}
          >
            <PanelCollapseIcon className="h-[18px] w-[18px] shrink-0" />
            {!collapsed ? (
              <span className="text-[11px] font-medium">메뉴 접기</span>
            ) : null}
          </button>
        </div>
      </div>
    </aside>
  );
}
