import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { HelpMobileModuleSelect, HelpSidebar, helpModuleDomId } from '../components/help/HelpSidebar';
import { HelpScreenCard } from '../components/help/HelpScreenCard';
import { AdminGuideHelpLayout } from '../components/help/AdminGuideHelpLayout';
import { TeamGuideHelpLayout } from '../components/help/TeamGuideHelpLayout';
import { HelpUiGallery } from '../components/help/ui/HelpUiGallery';
import type { HelpRole } from '../types/helpContent';
import {
  fetchHelpContent,
  filterHelpEntries,
  groupHelpByModule,
  HELP_ROLE_LABELS,
  HELP_WORKFLOW_CHAPTER_ID,
  parseHelpRole,
  WORKFLOW_GUIDE_URL,
} from '../utils/helpContent';
import { checkHelpEditPermission } from '../api/help';
import { HelpCustomerBoardView } from '../components/customer-board/HelpCustomerBoardView';
import { HelpCmsBrowseView } from '../components/help-cms/HelpCmsBrowseView';
import { fetchPublicHelpCmsCategories } from '../api/publicHelpCms';
import type { HelpCmsCategory } from '../api/platformHelpCms';

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
  const sectionParam = searchParams.get('section') || '';
  const articleParam = searchParams.get('article') || '';
  const postParam = searchParams.get('post') || '';

  const [mainCategory, setMainCategory] = useState<MainCategory>(categoryParam);
  const [entries, setEntries] = useState<Awaited<ReturnType<typeof fetchHelpContent>>>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeModule, setActiveModule] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [cmsCategories, setCmsCategories] = useState<HelpCmsCategory[]>([]);

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

  useEffect(() => {
    if (mainCategory !== 'usage' && mainCategory !== 'notice') return;
    let cancelled = false;
    fetchPublicHelpCmsCategories(mainCategory)
      .then((items) => {
        if (!cancelled) setCmsCategories(items);
      })
      .catch(() => {
        if (!cancelled) setCmsCategories([]);
      });
    return () => {
      cancelled = true;
    };
  }, [mainCategory]);

  const setCmsSection = useCallback(
    (section: string | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (section) {
          next.set('section', section);
          next.delete('role');
          next.delete('chapter');
          next.delete('q');
        } else {
          next.delete('section');
        }
        next.delete('article');
        return next;
      });
    },
    [setSearchParams],
  );

  const setCustomerBoardPost = useCallback(
    (postId: string | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (postId) next.set('post', postId);
        else next.delete('post');
        return next;
      });
    },
    [setSearchParams],
  );

  const setCmsArticle = useCallback(
    (article: string | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        if (article) next.set('article', article);
        else next.delete('article');
        return next;
      });
    },
    [setSearchParams],
  );

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
        if (newCategory !== 'usage' && newCategory !== 'notice') {
          next.delete('section');
          next.delete('article');
        }
        if (newCategory !== 'inquiry' && newCategory !== 'notice') {
          next.delete('post');
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
        if (newRole === 'team' || newRole === 'admin') {
          next.set('chapter', HELP_WORKFLOW_CHAPTER_ID);
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
  const isAdminGuideView = mainCategory === 'usage' && selectedRole === 'admin';
  const isHtmlGuideView = isTeamGuideView || isAdminGuideView;
  const isCmsUsageView = mainCategory === 'usage' && Boolean(sectionParam) && !isHtmlGuideView;

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
              <a
                href={WORKFLOW_GUIDE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg border border-slate-500 bg-slate-800 px-4 py-1.5 text-fluid-sm font-semibold text-white shadow-sm transition-colors hover:bg-slate-700"
              >
                소개서
              </a>
            </nav>
          </div>

          {/* 검색 (관리자 사용법에서만) */}
          {mainCategory === 'usage' && !isHtmlGuideView ? (
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
      <div
        className={`mx-auto max-w-screen-2xl ${
          isHtmlGuideView ? 'px-2 py-3 sm:px-3 lg:px-4 lg:py-4' : 'px-4 py-6 sm:px-6 lg:px-8'
        }`}
      >
        {mainCategory === 'usage' ? (
          isCmsUsageView ? (
            <HelpCmsBrowseView
              tabGroup="usage"
              sectionSlug={sectionParam || null}
              articleSlug={articleParam || null}
              onSectionChange={setCmsSection}
              onArticleChange={setCmsArticle}
            />
          ) : isAdminGuideView ? (
            <AdminGuideHelpLayout
              selectedRole={selectedRole}
              onRoleChange={changeRole}
              cmsCategories={cmsCategories}
              onCmsSectionSelect={setCmsSection}
            />
          ) : isTeamGuideView ? (
            <TeamGuideHelpLayout
              selectedRole={selectedRole}
              onRoleChange={changeRole}
              cmsCategories={cmsCategories}
              onCmsSectionSelect={setCmsSection}
            />
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
                {cmsCategories.length > 0 ? (
                  <div className="mt-4 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
                    <p className="mb-2 text-fluid-2xs font-semibold text-slate-500">카테고리 글</p>
                    <ul className="space-y-1">
                      {cmsCategories.map((cat) => (
                        <li key={cat.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setCmsSection(cat.slug);
                            }}
                            className="w-full rounded-md px-2 py-1.5 text-left text-fluid-2xs text-slate-700 hover:bg-slate-100"
                          >
                            {cat.label}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
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
          <HelpCustomerBoardView
            boardSlug="inquiry"
            postIdFromUrl={postParam || null}
            onPostIdChange={setCustomerBoardPost}
          />
        ) : (
          <HelpCustomerBoardView
            boardSlug="notice"
            postIdFromUrl={postParam || null}
            onPostIdChange={setCustomerBoardPost}
          />
        )}
      </div>
    </div>
  );
}
