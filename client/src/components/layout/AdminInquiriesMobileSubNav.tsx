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
import { MobileInlineMenuButton } from './MobileFloatingMenuButton';

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
    'group flex min-w-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] transition-all touch-manipulation',
    isActive
      ? 'bg-blue-50/80 font-semibold text-blue-700'
      : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900',
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

/** 모바일 — 페이지 제목 왼쪽 인라인 햄버거 (fixed FAB 대신) */
export function AdminInquiriesMobileInlineMenuButton({ className = '' }: { className?: string }) {
  const { openMenu, showBadgeDot } = useAdminInquiriesMobileMenu();
  return (
    <MobileInlineMenuButton
      onClick={openMenu}
      aria-label="서비스접수 하위 메뉴"
      title="서비스접수 하위 메뉴"
      showBadgeDot={showBadgeDot}
      className={className}
    >
      <BarsIcon className="h-5 w-5" />
    </MobileInlineMenuButton>
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
        className={`absolute inset-0 bg-slate-900/30 backdrop-blur-sm transition-opacity duration-300 ${
          slideIn ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
      />

      <aside
        role="dialog"
        aria-modal
        aria-labelledby="admin-inquiries-drawer-title"
        className={`absolute inset-y-0 left-0 flex w-[min(16rem,82vw)] max-w-full flex-col bg-white shadow-2xl transform transition-transform duration-300 ease-out ${
          slideIn ? 'translate-x-0' : '-translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-3">
          <h2 id="admin-inquiries-drawer-title" className="font-bold text-slate-800 text-fluid-base">
            서비스접수
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700 touch-manipulation transition-colors"
            aria-label="닫기"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <nav aria-label="서비스접수 하위 메뉴" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 pb-4">
          <ul className="space-y-0.5">
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
                      {({ isActive }) => (
                        <>
                          <AdminSideNavIcon
                            id={icon}
                            className={`h-4 w-4 shrink-0 transition-colors ${
                              isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500'
                            }`}
                          />
                          <span className="min-w-0 flex-1 truncate">{item.label}</span>
                          {badge > 0 ? (
                            <span className="shrink-0 rounded-full bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white tabular-nums shadow-sm">
                              {badge > 99 ? '99+' : badge}
                            </span>
                          ) : null}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              }

              return (
                <li key={item.label} className="pt-1">
                  <div className="mb-0.5 mt-1 px-2.5 text-[11px] font-bold tracking-wider text-slate-400/80 uppercase">
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
                            {({ isActive }) => (
                              <>
                                <AdminSideNavIcon
                                  id={icon}
                                  className={`h-4 w-4 shrink-0 transition-colors ${
                                    isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-500'
                                  }`}
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
      </aside>
    </div>,
    root,
  );
}

/** 레이아웃 — 접수목록 외 하위 페이지 모바일 제목 + 인라인 햄버거 */
export function AdminInquiriesMobileSubNavBar() {
  return (
    <div className="mb-2 flex min-w-0 items-center gap-1.5 lg:hidden">
      <AdminInquiriesMobileInlineMenuButton />
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
      <AdminInquiriesMobileMenuSheet
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        items={items}
      />
    </AdminInquiriesMobileMenuContext.Provider>
  );
}
