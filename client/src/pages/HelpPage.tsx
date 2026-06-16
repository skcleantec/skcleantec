import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HelpMobileModuleSelect, HelpSidebar, helpModuleDomId } from '../components/help/HelpSidebar';
import { HelpScreenCard } from '../components/help/HelpScreenCard';
import type { HelpRole } from '../types/helpContent';
import {
  fetchHelpContent,
  filterHelpEntries,
  groupHelpByModule,
  HELP_ROLE_LABELS,
} from '../utils/helpContent';

function parseHelpRole(raw: string | null): HelpRole {
  return raw === 'crew' ? 'crew' : 'admin';
}

export function HelpPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof fetchHelpContent>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<string | null>(null);

  const role = parseHelpRole(searchParams.get('role'));
  const query = searchParams.get('q') ?? '';

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchHelpContent()
      .then((data) => {
        if (!cancelled) setEntries(data);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '불러오기 실패');
          setEntries([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => filterHelpEntries(entries, role, query), [entries, role, query]);

  const moduleGroups = useMemo(() => groupHelpByModule(filtered), [filtered]);

  const moduleNames = useMemo(() => moduleGroups.map((g) => g.module), [moduleGroups]);

  const moduleOrderByName = useMemo(() => {
    const map = new Map<string, number>();
    for (const g of moduleGroups) map.set(g.module, g.moduleOrder);
    return map;
  }, [moduleGroups]);

  const setRole = useCallback(
    (next: HelpRole) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          p.set('role', next);
          return p;
        },
        { replace: true }
      );
      setActiveModule(null);
    },
    [setSearchParams]
  );

  const setQuery = useCallback(
    (next: string) => {
      setSearchParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next.trim()) p.set('q', next);
          else p.delete('q');
          return p;
        },
        { replace: true }
      );
    },
    [setSearchParams]
  );

  const scrollToModule = useCallback((module: string) => {
    setActiveModule(module);
    const el = document.getElementById(helpModuleDomId(module));
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="min-h-screen bg-slate-100">
      <header className="border-b border-slate-800 bg-slate-900 text-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div>
            <p className="text-fluid-xs uppercase tracking-wider text-slate-400">청소비서 도움말</p>
            <h1 className="text-xl font-semibold tracking-tight sm:text-2xl">화면별 사용법</h1>
          </div>
          <a
            href="/login"
            className="rounded-xl border border-white/20 bg-white/10 px-3 py-2 text-fluid-xs font-medium hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400"
          >
            로그인으로
          </a>
        </div>
      </header>

      <div className="mx-auto flex max-w-7xl min-h-[calc(100vh-4.5rem)]">
        <HelpSidebar
          role={role}
          onRoleChange={setRole}
          modules={moduleNames}
          moduleOrderByName={moduleOrderByName}
          activeModule={activeModule}
          onModuleClick={scrollToModule}
          className="hidden w-64 shrink-0 lg:flex lg:sticky lg:top-0 lg:h-[calc(100vh-4.5rem)]"
        />

        <main className="min-w-0 flex-1 px-4 py-5 sm:px-6 lg:py-6">
          <div className="mb-5 space-y-3">
            <div className="lg:hidden">
              <div className="flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-200" role="tablist">
                {(['admin', 'crew'] as HelpRole[]).map((r) => (
                  <button
                    key={r}
                    type="button"
                    role="tab"
                    aria-selected={role === r}
                    onClick={() => setRole(r)}
                    className={`flex-1 rounded-lg px-2 py-2 text-fluid-xs font-medium ${
                      role === r ? 'bg-slate-900 text-white' : 'text-slate-600'
                    }`}
                  >
                    {HELP_ROLE_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>

            <label className="block">
              <span className="sr-only">검색</span>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="화면 이름·내용 검색…"
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-fluid-sm text-slate-800 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
              />
            </label>

            <HelpMobileModuleSelect
              modules={moduleNames}
              moduleOrderByName={moduleOrderByName}
              value={activeModule ?? ''}
              onChange={(module) => {
                if (module) scrollToModule(module);
              }}
            />
          </div>

          {loading ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-fluid-sm text-slate-500">
              불러오는 중…
            </p>
          ) : error ? (
            <p className="rounded-2xl border border-red-200 bg-red-50 p-6 text-fluid-sm text-red-700" role="alert">
              {error}
            </p>
          ) : moduleGroups.length === 0 ? (
            <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-fluid-sm text-slate-500">
              {query.trim()
                ? '검색 결과가 없습니다.'
                : `${HELP_ROLE_LABELS[role]} 도움말이 아직 없습니다.`}
            </p>
          ) : (
            <div className="space-y-10">
              {moduleGroups.map((group) => (
                <section
                  key={group.module}
                  id={helpModuleDomId(group.module)}
                  className="scroll-mt-24"
                  aria-labelledby={`${helpModuleDomId(group.module)}-title`}
                >
                  <div className="mb-4 flex items-end justify-between gap-2 border-b border-slate-200 pb-2">
                    <h2
                      id={`${helpModuleDomId(group.module)}-title`}
                      className="text-xl font-semibold tracking-tight text-slate-900"
                    >
                      {group.module}
                    </h2>
                    <span className="text-fluid-2xs text-slate-400">{group.items.length}화면</span>
                  </div>
                  <div className="space-y-4">
                    {group.items.map((entry) => (
                      <HelpScreenCard key={`${entry.path}-${entry.title}`} entry={entry} />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
