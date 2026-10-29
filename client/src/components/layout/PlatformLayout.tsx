import { useCallback, useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PLATFORM_NAV_GROUPS, isPlatformNavActive } from '../../constants/platformNav';
import { fetchPlatformInbox } from '../../api/platformInbox';
import { usePlatformOpsAlert, type PlatformOpsAlert } from '../../hooks/usePlatformOpsAlert';
import { clearPlatformToken } from '../../stores/platformAuth';
import { TenantBrandLogo } from '../brand/TenantBrandLogo';

function SidebarNav({
  pathname,
  pendingTotal,
  onNavigate,
}: {
  pathname: string;
  pendingTotal: number;
  onNavigate?: () => void;
}) {
  return (
    <nav className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto overscroll-y-contain px-3 py-2">
      {PLATFORM_NAV_GROUPS.map((group) => (
        <div key={group.label} className="mb-1">
          <p className="px-3 pb-1 pt-3 text-xs font-semibold text-gray-500">{group.label}</p>
          {group.items.map((item) => {
            const active = isPlatformNavActive(pathname, item.to);
            const showBadge = item.to === '/platform/inbox' && pendingTotal > 0;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/platform/tenants' || item.to === '/platform/card-payment' || item.to === '/platform/billing'}
                onClick={onNavigate}
                className={[
                  'flex items-center justify-between rounded-lg px-3 py-2 text-sm transition-colors',
                  active
                    ? 'bg-white/10 font-medium text-white'
                    : 'text-gray-400 hover:bg-white/5 hover:text-white',
                ].join(' ')}
              >
                <span>{item.label}</span>
                {showBadge ? (
                  <span className="rounded-full bg-amber-400 px-1.5 py-0 text-fluid-2xs font-semibold text-gray-900">
                    {pendingTotal}
                  </span>
                ) : null}
              </NavLink>
            );
          })}
        </div>
      ))}
    </nav>
  );
}

export function PlatformLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [toast, setToast] = useState<PlatformOpsAlert | null>(null);
  const pathname = location.pathname;

  const refreshBadge = useCallback(async () => {
    try {
      const inbox = await fetchPlatformInbox();
      setPendingTotal(inbox.pendingTotal);
    } catch {
      /* 배지 실패는 화면을 막지 않는다 */
    }
  }, []);

  useEffect(() => {
    void refreshBadge();
    const onAlert = () => void refreshBadge();
    window.addEventListener('cbiseo:platform-alert', onAlert);
    return () => window.removeEventListener('cbiseo:platform-alert', onAlert);
  }, [refreshBadge]);

  usePlatformOpsAlert(true, (alert) => {
    setToast(alert);
    window.setTimeout(() => setToast((current) => (current?.at === alert.at ? null : current)), 6000);
  });

  const handleLogout = () => {
    clearPlatformToken();
    navigate('/platform/login');
  };

  const sidebar = (onNavigate?: () => void) => (
    <>
      <div className="shrink-0 border-b border-white/10 px-4 py-5">
        <Link to="/platform/tenants" onClick={onNavigate} className="block space-y-1">
          <TenantBrandLogo height={28} />
          <span className="text-xs font-normal text-gray-500">Platform</span>
        </Link>
      </div>
      <SidebarNav pathname={pathname} pendingTotal={pendingTotal} onNavigate={onNavigate} />
      <div className="mt-auto shrink-0 space-y-1 border-t border-white/10 p-3">
        <button
          type="button"
          onClick={handleLogout}
          className="w-full rounded-lg px-3 py-2 text-left text-sm text-gray-400 transition hover:bg-white/5 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-900"
        >
          로그아웃
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-full min-h-0 flex-1 overflow-hidden bg-gray-100">
      <aside className="hidden h-full min-h-0 w-60 shrink-0 flex-col overflow-hidden bg-gray-900 lg:flex">{sidebar()}</aside>

      {mobileNavOpen ? (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            aria-label="메뉴 닫기"
            onClick={() => setMobileNavOpen(false)}
          />
          <aside className="fixed inset-y-0 left-0 z-50 flex min-h-0 w-64 flex-col overflow-hidden bg-gray-900 shadow-xl lg:hidden">
            {sidebar(() => setMobileNavOpen(false))}
          </aside>
        </>
      ) : null}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
        <header className="staff-top-safe flex min-h-14 shrink-0 items-center gap-3 border-b border-gray-200 bg-white px-4 pb-2 lg:hidden">
          <button
            type="button"
            className="rounded-lg p-2 text-gray-600 hover:bg-gray-100"
            aria-label="메뉴 열기"
            onClick={() => setMobileNavOpen(true)}
          >
            ☰
          </button>
          <span className="text-sm font-semibold text-gray-900">운영 콘솔</span>
          {pendingTotal > 0 ? (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-fluid-2xs font-semibold text-amber-900">
              할 일 {pendingTotal}
            </span>
          ) : null}
        </header>

        <main className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
            <Outlet />
          </div>
        </main>
      </div>
      {toast ? (
        <div className="fixed right-4 top-4 z-[80] w-[min(100%-2rem,22rem)] rounded-xl border border-amber-200 bg-white p-3 shadow-lg">
          <p className="text-fluid-sm font-semibold text-gray-900">{toast.title}</p>
          <p className="mt-1 text-fluid-xs text-gray-600">{toast.body}</p>
          <Link
            to={toast.href}
            onClick={() => setToast(null)}
            className="mt-2 inline-flex rounded-lg bg-slate-900 px-3 py-1.5 text-fluid-xs font-medium text-white hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400 focus-visible:ring-offset-2"
          >
            오늘 할 일
          </Link>
        </div>
      ) : null}
    </div>
  );
}
