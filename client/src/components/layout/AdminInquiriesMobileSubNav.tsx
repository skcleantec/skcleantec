import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { NavLink } from 'react-router-dom';
import type { AdminSideNavItem } from './AdminSectionSideNav';
import { AdminSideNavIcon, resolveAdminSideNavIcon } from './adminSideNavIcons';
import { MobileFloatingMenuButton } from './MobileFloatingMenuButton';

function BarsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M4 7h16M4 12h16M4 17h16" strokeLinecap="round" />
    </svg>
  );
}

function CloseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
      <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" />
    </svg>
  );
}

function hasInquiriesNavBadge(items: AdminSideNavItem[]): boolean {
  return items.some((item) => item.type === 'link' && (item.badge ?? 0) > 0);
}

function mobileNavLinkClass(isActive: boolean): string {
  return [
    'flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-2 text-fluid-sm transition-colors touch-manipulation',
    isActive ? 'bg-slate-100 font-semibold text-slate-900' : 'text-slate-700 hover:bg-slate-50',
  ].join(' ');
}

type AdminInquiriesMobileMenuContextValue = {
  openMenu: () => void;
  showBadgeDot: boolean;
};

const AdminInquiriesMobileMenuContext = createContext<AdminInquiriesMobileMenuContextValue | null>(null);

export function useAdminInquiriesMobileMenu(): AdminInquiriesMobileMenuContextValue {
  const ctx = useContext(AdminInquiriesMobileMenuContext);
  if (!ctx) {
    throw new Error('useAdminInquiriesMobileMenu must be used within AdminInquiriesMobileMenuProvider');
  }
  return ctx;
}

/** 모바일 플로팅 햄버거는 Provider에서 렌더. PC는 사이드 메뉴 사용 */
function AdminInquiriesMobileFloatingMenuButton() {
  const { openMenu, showBadgeDot } = useAdminInquiriesMobileMenu();
  return (
    <MobileFloatingMenuButton
      onClick={openMenu}
      aria-label="서비스접수 하위 메뉴"
      title="서비스접수 하위 메뉴"
      showBadgeDot={showBadgeDot}
    >
      <BarsIcon className="h-5 w-5" />
    </MobileFloatingMenuButton>
  );
}

function AdminInquiriesMobileMenuSheet({
  open,
  onClose,
  items,
}: {
  open: boolean;
  onClose: () => void;
  items: AdminSideNavItem[];
}) {
  const [slideIn, setSlideIn] = useState(false);

  useEffect(() => {
    if (!open) {
      setSlideIn(false);
      return;
    }
    const id = requestAnimationFrame(() => setSlideIn(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;
  const root = typeof document !== 'undefined' ? document.body : null;
  if (!root) return null;

  return createPortal(
    <div className="fixed inset-0 z-[610] lg:hidden" role="presentation">
      <button
        type="button"
        aria-label="메뉴 닫기"
        className={`absolute inset-0 bg-black/40 transition-opacity duration-200 ${
          slideIn ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal
        aria-labelledby="admin-inquiries-drawer-title"
        className={`absolute inset-y-0 left-0 flex w-[min(17.5rem,82vw)] max-w-full flex-col bg-white shadow-2xl border-r border-slate-200 transform transition-transform duration-200 ease-out ${
          slideIn ? 'translate-x-0' : '-translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2.5">
          <h2 id="admin-inquiries-drawer-title" className="font-semibold text-slate-900 text-fluid-sm">
            서비스접수
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-800 touch-manipulation"
            aria-label="닫기"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="서비스접수 하위 메뉴" className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-2">
          <ul className="space-y-1 px-2">
            {items.map((item) => {
              if (item.type === 'link') {
                const icon = item.icon ?? resolveAdminSideNavIcon(item.to);
                const badge = item.badge ?? 0;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.end}
                      title={item.title ?? item.label}
                      className={({ isActive }) => mobileNavLinkClass(isActive)}
                      onClick={onClose}
                    >
                      <AdminSideNavIcon id={icon} className="h-4 w-4 shrink-0 text-slate-500" />
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {badge > 0 ? (
                        <span className="shrink-0 rounded-full bg-red-600 px-1.5 py-0.5 text-[10px] font-semibold text-white tabular-nums">
                          {badge > 99 ? '99+' : badge}
                        </span>
                      ) : null}
                    </NavLink>
                  </li>
                );
              }

              return (
                <li key={item.label} className="pt-1">
                  <div className="px-2.5 pb-1 text-[11px] font-semibold tracking-tight text-slate-500">
                    {item.label}
                  </div>
                  <ul className="space-y-0.5">
                    {item.children.map((child) => {
                      const icon = child.icon ?? resolveAdminSideNavIcon(child.to);
                      return (
                        <li key={child.to}>
                          <NavLink
                            to={child.to}
                            end={child.end}
                            title={child.title ?? child.label}
                            className={({ isActive }) => mobileNavLinkClass(isActive)}
                            onClick={onClose}
                          >
                            <AdminSideNavIcon id={icon} className="h-4 w-4 shrink-0 text-slate-500" />
                            <span className="min-w-0 flex-1 truncate">{child.label}</span>
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
      </aside>
    </div>,
    root,
  );
}

/** 레이아웃 — 접수목록 외 하위 페이지 모바일 제목(플로팅 햄버거는 Provider) */
export function AdminInquiriesMobileSubNavBar() {
  return (
    <div className="mb-2 flex min-w-0 items-center gap-2 pl-12 lg:pl-0 lg:hidden">
      <span className="min-w-0 truncate text-fluid-sm font-semibold text-slate-900">서비스접수</span>
    </div>
  );
}

export function AdminInquiriesMobileMenuProvider({
  items,
  children,
}: {
  items: AdminSideNavItem[];
  children: ReactNode;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const showBadgeDot = useMemo(() => hasInquiriesNavBadge(items), [items]);
  const openMenu = useCallback(() => setMenuOpen(true), []);

  const value = useMemo(
    () => ({
      openMenu,
      showBadgeDot,
    }),
    [openMenu, showBadgeDot],
  );

  return (
    <AdminInquiriesMobileMenuContext.Provider value={value}>
      {children}
      <AdminInquiriesMobileFloatingMenuButton />
      <AdminInquiriesMobileMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={items}
      />
    </AdminInquiriesMobileMenuContext.Provider>
  );
}
