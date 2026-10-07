import { Suspense, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom';
import { LineMdIcon } from '../../../components/ui/LineMdIcon';
import { useLoginScrollSurface } from '../../../hooks/useMobileInputVisibility';
import { PG_PARTNER_NAV } from './pgPartnerNav';
import { clearPgPartnerToken, readPgPartnerToken } from './pgPartnerSession';

const LINK =
  'flex min-h-10 items-center gap-2 rounded-lg px-3 text-fluid-xs font-medium hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40';

function NavItems({ onPick }: { onPick?: () => void }) {
  return (
    <nav className="space-y-1">
      {PG_PARTNER_NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          onClick={onPick}
          className={({ isActive }) =>
            `${LINK} ${isActive ? 'bg-white/10 text-white ring-1 ring-inset ring-white/15' : 'text-slate-300'}`
          }
        >
          <LineMdIcon name={item.icon} className="size-4 shrink-0" />
          <span className="truncate">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

export function PgPartnerShell() {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { scrollRef, onFieldFocus } = useLoginScrollSurface(true);
  if (!readPgPartnerToken()) return <Navigate to="/pg-partner" replace />;

  const logout = () => {
    clearPgPartnerToken();
    navigate('/pg-partner', { replace: true });
  };

  return (
    <div className="flex min-h-dvh bg-slate-100">
      <aside className="hidden w-56 shrink-0 flex-col bg-slate-900 lg:flex">
        <div className="px-4 py-5">
          <p className="text-fluid-sm font-semibold text-white">원성페이먼츠</p>
          <p className="mt-0.5 text-fluid-2xs text-slate-400">PG 관리</p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-2">
          <NavItems />
        </div>
        <div className="p-3">
          <button
            type="button"
            onClick={logout}
            className="min-h-10 w-full rounded-lg border border-white/15 px-3 text-fluid-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
          >
            로그아웃
          </button>
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex items-center gap-2 border-b border-slate-200 bg-white px-3 py-2 lg:hidden">
          <button
            type="button"
            aria-label="메뉴"
            onClick={() => setOpen(true)}
            className="inline-flex size-10 items-center justify-center rounded-lg text-slate-800 hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
          >
            <LineMdIcon name="menu" className="size-5" />
          </button>
          <p className="text-fluid-sm font-semibold text-slate-900">원성페이먼츠</p>
        </header>
        <main ref={scrollRef} onFocusCapture={onFieldFocus} className="login-surface min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-3xl px-3 py-4 sm:px-6 sm:py-6">
            <Suspense fallback={<p className="text-fluid-sm text-slate-500">불러오는 중…</p>}>
              <Outlet />
            </Suspense>
          </div>
        </main>
      </div>
      {open
        ? createPortal(
            <div className="fixed inset-0 z-[80] lg:hidden">
              <button type="button" aria-label="메뉴 닫기" className="absolute inset-0 bg-slate-900/40" onClick={() => setOpen(false)} />
              <div className="relative flex h-full w-64 flex-col bg-slate-900 shadow-xl">
                <div className="flex items-center justify-between px-4 py-4">
                  <p className="text-fluid-sm font-semibold text-white">원성페이먼츠</p>
                  <button
                    type="button"
                    aria-label="닫기"
                    onClick={() => setOpen(false)}
                    className="inline-flex size-10 items-center justify-center rounded-lg text-white hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    <LineMdIcon name="close" className="size-5" />
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto px-2">
                  <NavItems onPick={() => setOpen(false)} />
                </div>
                <div className="p-3">
                  <button
                    type="button"
                    onClick={logout}
                    className="min-h-10 w-full rounded-lg border border-white/15 px-3 text-fluid-xs font-medium text-slate-200 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
                  >
                    로그아웃
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
