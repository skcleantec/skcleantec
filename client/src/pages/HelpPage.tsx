import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HelpMobileModuleSelect, HelpSidebar, helpModuleDomId } from '../components/help/HelpSidebar';
import { HelpScreenCard } from '../components/help/HelpScreenCard';
import { TeamGuideHelpLayout } from '../components/help/TeamGuideHelpLayout';
import { HelpUiGallery } from '../components/help/ui/HelpUiGallery';
import type { HelpRole } from '../types/helpContent';
import {
  fetchHelpContent,
  filterHelpEntries,
  groupHelpByModule,
  HELP_ROLE_LABELS,
  parseHelpRole,
} from '../utils/helpContent';
import { checkHelpEditPermission } from '../api/help';

type MainCategory = 'usage' | 'inquiry' | 'notice';

const MAIN_CATEGORIES: { id: MainCategory; label: string }[] = [
  { id: 'usage', label: '사용법' },
  { id: 'inquiry', label: '고객문의' },
  { id: 'notice', label: '공지사항' },
];

export function HelpPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const categoryParam = (searchParams.get('category') || 'usage') as MainCategory;
  const roleParam = searchParams.get('role') || '';
  const searchQuery = searchParams.get('q') || '';

  const [mainCategory, setMainCategory] = useState<MainCategory>(categoryParam);
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof fetchHelpContent>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  const selectedRole = useMemo(() => parseHelpRole(roleParam), [roleParam]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchHelpContent(), checkHelpEditPermission()])
      .then(([data, permission]) => {
        if (!cancelled) {
          setEntries(data);
          setCanEdit(permission.canEdit);
        }
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

  const refreshEntries = useCallback(() => {
    fetchHelpContent()
      .then(setEntries)
      .catch(() => {});
  }, []);

  const changeMainCategory = useCallback(
    (newCategory: MainCategory) => {
      setMainCategory(newCategory);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('category', newCategory);
        if (newCategory !== 'usage') {
          next.delete('role');
          next.delete('q');
        }
        return next;
      });
      setActiveModule(null);
    },
    [setSearchParams]
  );

  const changeRole = useCallback(
    (newRole: HelpRole) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('role', newRole);
        next.delete('q');
        if (newRole === 'team') {
          next.set('chapter', '01');
        } else {
          next.delete('chapter');
        }
        return next;
      });
      setActiveModule(null);
    },
    [setSearchParams]
  );

  const changeSearch = useCallback(
    (query: string) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (query.trim()) {
          next.set('q', query);
        } else {
          next.delete('q');
        }
        return next;
      });
    },
    [setSearchParams]
  );

  const filtered = useMemo(
    () => filterHelpEntries(entries, selectedRole, searchQuery),
    [entries, selectedRole, searchQuery]
  );

  const groups = useMemo(() => groupHelpByModule(filtered), [filtered]);

  const showUiGallery = canEdit && searchParams.get('ui') === 'gallery';
  const isTeamGuideView = mainCategory === 'usage' && selectedRole === 'team';

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* 상단 헤더 - 고정 */}
      <header className="sticky top-0 z-30 border-b border-slate-700 bg-slate-900 shadow-lg">
        <div className="mx-auto max-w-screen-2xl px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {/* 로고 & 타이틀 */}
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                📚 청소비서 도움말
              </h1>
            </div>

            {/* 메인 카테고리 탭 */}
            <nav className="flex flex-wrap items-center gap-2">
              {MAIN_CATEGORIES.map((cat) => {
                const isActive = mainCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => changeMainCategory(cat.id)}
                    className={`
                      rounded-lg px-4 py-1.5 text-fluid-sm font-medium transition-all
                      ${
                        isActive
                          ? 'bg-white text-slate-900 shadow-md'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }
                    `}
                  >
                    {cat.label}
                  </button>
                );
              })}
              {canEdit ? (
                <a
                  href="/help?category=usage&ui=gallery"
                  className={`rounded-lg px-3 py-1.5 text-fluid-2xs font-medium ${
                    showUiGallery
                      ? 'bg-sky-500 text-white'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  UI 갤러리
                </a>
              ) : null}
            </nav>
          </div>

          {/* 검색 (관리자 사용법에서만) */}
          {mainCategory === 'usage' && selectedRole !== 'team' ? (
            <div className="mt-2 max-w-md">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => changeSearch(e.target.value)}
                placeholder="화면 이름·내용 검색..."
                className="w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-fluid-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          ) : null}
        </div>
      </header>

      {/* 메인 콘텐츠 영역 */}
      <div className="mx-auto max-w-screen-2xl px-4 py-6 sm:px-6 lg:px-8">
        {mainCategory === 'usage' ? (
          isTeamGuideView ? (
            <TeamGuideHelpLayout selectedRole={selectedRole} onRoleChange={changeRole} />
          ) : loading ? (
            <div className="flex min-h-[40vh] items-center justify-center">
              <div className="text-center">
                <div className="inline-block h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slate-600" />
                <p className="mt-4 text-fluid-sm text-slate-600">불러오는 중...</p>
              </div>
            </div>
          ) : error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center">
              <p className="text-fluid-sm font-semibold text-red-700">{error}</p>
            </div>
          ) : (
            <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:gap-8">
              {/* 왼쪽 사이드바 (PC) */}
              <div className="hidden lg:block lg:w-64 lg:shrink-0 lg:self-start">
                <HelpSidebar
                  groups={groups}
                  activeModule={activeModule}
                  onModuleClick={setActiveModule}
                  selectedRole={selectedRole}
                  onRoleChange={changeRole}
                />
              </div>

              {/* 메인 콘텐츠 */}
              <main className="flex-1 min-w-0">
                {/* 모바일 역할 선택 + 모듈 선택 */}
                <div className="mb-6 space-y-3 lg:hidden">
                  {/* 역할 선택 */}
                  <div className="flex rounded-lg bg-white p-1 shadow-sm ring-1 ring-slate-200">
                    {(['admin', 'team'] as const).map((role) => {
                      const isActive = selectedRole === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => changeRole(role)}
                          className={`
                            flex-1 rounded-md px-3 py-2 text-fluid-sm font-semibold transition-all
                            ${
                              isActive
                                ? 'bg-slate-900 text-white'
                                : 'text-slate-600 hover:bg-slate-100'
                            }
                          `}
                        >
                          {HELP_ROLE_LABELS[role]}
                        </button>
                      );
                    })}
                  </div>

                  {/* 모듈 선택 드롭다운 */}
                  <HelpMobileModuleSelect
                    groups={groups}
                    activeModule={activeModule}
                    onModuleChange={setActiveModule}
                  />
                </div>

                {showUiGallery ? <HelpUiGallery /> : null}

                {groups.length === 0 ? (
                  <div className="rounded-xl border border-slate-200 bg-white p-8 text-center">
                    <p className="text-fluid-sm text-slate-500">
                      {searchQuery ? '검색 결과가 없습니다.' : '도움말 콘텐츠가 없습니다.'}
                    </p>
                  </div>
                ) : (
                  groups.map((group) => (
                    <section key={group.module} id={helpModuleDomId(group.module)} className="mb-8">
                      <div className="mb-4 flex items-baseline justify-between border-b border-slate-200 pb-2">
                        <h2 className="text-xl font-bold tracking-tight text-slate-900">
                          {group.module}
                        </h2>
                        {searchQuery ? (
                          <span className="text-fluid-xs text-slate-500">
                            {group.items.length}건
                          </span>
                        ) : null}
                      </div>
                      <div className="space-y-4">
                        {group.items.map((entry) => (
                          <HelpScreenCard
                            key={`${entry.path}-${entry.title}`}
                            entry={entry}
                            canEdit={canEdit}
                            onUpdated={refreshEntries}
                          />
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </main>
            </div>
          )
        ) : mainCategory === 'inquiry' ? (
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">고객문의</h2>
              <p className="text-slate-600 mb-6">
                궁금하신 사항이 있으시면 아래 연락처로 문의해주세요.
              </p>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="text-2xl">📞</div>
                  <div>
                    <p className="font-semibold text-slate-900">전화 문의</p>
                    <p className="text-slate-600">1234-5678 (평일 09:00 - 18:00)</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className="text-2xl">✉️</div>
                  <div>
                    <p className="font-semibold text-slate-900">이메일 문의</p>
                    <p className="text-slate-600">support@skcleanteck.com</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl">
            <div className="rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
              <h2 className="text-2xl font-bold text-slate-900 mb-4">공지사항</h2>
              <div className="space-y-4">
                <div className="border-b border-slate-200 pb-4">
                  <p className="text-fluid-sm text-slate-500 mb-1">2026.06.23</p>
                  <h3 className="font-semibold text-slate-900">헬프 페이지 편집 기능 추가</h3>
                  <p className="text-slate-600 mt-2">
                    관리자가 헬프 페이지에서 직접 스크린샷과 내용을 편집할 수 있습니다.
                  </p>
                </div>
                <div className="border-b border-slate-200 pb-4">
                  <p className="text-fluid-sm text-slate-500 mb-1">2026.06.22</p>
                  <h3 className="font-semibold text-slate-900">DB 장터 장바구니 기능 추가</h3>
                  <p className="text-slate-600 mt-2">
                    여러 접수를 한 번에 선택하여 게시하거나 갖고가기할 수 있습니다.
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
