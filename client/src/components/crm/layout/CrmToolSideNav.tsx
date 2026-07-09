import { useCallback, useEffect, useState, type ReactNode } from 'react';

const STORAGE_KEY = 'sk_telecrm_tool_nav_collapsed';

function readCollapsed(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

function CrmIconMessage({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2v10z" />
    </svg>
  );
}

function PanelCollapseIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6" />
    </svg>
  );
}

export type CrmToolNavItem = {
  id: string;
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  loading?: boolean;
};

/** CRM 좌측 접이식 도구 메뉴 (관리자 솔루션 사이드와 유사) */
export function CrmToolSideNav({ items }: { items: CrmToolNavItem[] }) {
  const [collapsed, setCollapsed] = useState(readCollapsed);

  const setCollapsedPersisted = useCallback((next: boolean) => {
    setCollapsed(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? '1' : '0');
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  const widthPx = collapsed ? 52 : 132;

  return (
    <aside
      className={[
        'hidden shrink-0 self-stretch md:flex min-w-0 flex-col',
        'transition-[width] duration-300 ease-in-out motion-reduce:transition-none',
      ].join(' ')}
      style={{ width: widthPx }}
      aria-label="CRM 도구 메뉴"
    >
      <div className="flex h-full min-h-0 flex-col overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 shadow-lg shadow-slate-900/20">
        {!collapsed ? (
          <div className="border-b border-slate-800 px-3 py-2.5">
            <p className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-200">도구</p>
          </div>
        ) : (
          <div className="flex h-10 items-center justify-center border-b border-slate-800" aria-hidden>
            <span className="h-1.5 w-1.5 rounded-full bg-slate-500" />
          </div>
        )}

        <nav className="min-h-0 flex-1 overflow-y-auto py-2">
          <ul className="space-y-1 px-1.5">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  title={item.loading ? `${item.label} 처리 중` : item.label}
                  disabled={item.disabled || item.loading}
                  onClick={item.onClick}
                  className={[
                    'relative flex w-full items-center rounded-xl text-slate-300 transition-colors',
                    'hover:bg-white/10 hover:text-white active:bg-white/10',
                    item.active ? 'bg-white/10 text-white' : '',
                    item.loading ? 'cursor-wait opacity-90' : '',
                    item.disabled && !item.loading ? 'cursor-not-allowed opacity-40' : '',
                    collapsed ? 'justify-center py-2.5' : 'gap-2 px-2.5 py-2',
                  ].join(' ')}
                >
                  {item.active ? (
                    <span
                      className="absolute left-0 top-1/2 h-5 w-0.5 -translate-y-1/2 rounded-full bg-violet-400"
                      aria-hidden
                    />
                  ) : null}
                  <span className="shrink-0 [&>svg]:h-[18px] [&>svg]:w-[18px]">{item.icon}</span>
                  {!collapsed ? (
                    <span className="min-w-0 truncate text-[11px] font-medium">
                      {item.loading ? '가져오는 중…' : item.label}
                    </span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t border-slate-800 p-1.5">
          <button
            type="button"
            onClick={() => setCollapsedPersisted(!collapsed)}
            className={[
              'flex w-full items-center rounded-xl text-slate-300 transition-colors',
              'hover:bg-white/10 hover:text-white',
              collapsed ? 'justify-center py-2.5' : 'gap-2 px-2.5 py-2',
            ].join(' ')}
            aria-label={collapsed ? '메뉴 펼치기' : '메뉴 접기'}
            aria-expanded={!collapsed}
          >
            <PanelCollapseIcon className="h-[18px] w-[18px] shrink-0" />
            {!collapsed ? <span className="text-[11px] font-medium text-slate-200">메뉴 접기</span> : null}
          </button>
        </div>
      </div>
    </aside>
  );
}

export { CrmIconMessage };
