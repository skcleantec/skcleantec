import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AdminGuideHelpLayout } from '../components/help/AdminGuideHelpLayout';
import { TeamGuideHelpLayout } from '../components/help/TeamGuideHelpLayout';
import { HelpUiGallery } from '../components/help/ui/HelpUiGallery';
import type { HelpRole } from '../types/helpContent';
import {
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
  const sectionParam = searchParams.get('section') || '';
  const articleParam = searchParams.get('article') || '';
  const postParam = searchParams.get('post') || '';
  const cmsSearchQ = searchParams.get('q') || '';
  const hasRoleParam = searchParams.has('role');

  const [mainCategory, setMainCategory] = useState<MainCategory>(categoryParam);
  const [canEdit, setCanEdit] = useState(false);
  const [cmsCategories, setCmsCategories] = useState<HelpCmsCategory[]>([]);

  const selectedRole = useMemo(() => parseHelpRole(roleParam), [roleParam]);

  useEffect(() => {
    let cancelled = false;
    checkHelpEditPermission()
      .then((permission) => {
        if (!cancelled) setCanEdit(permission.canEdit);
      })
      .catch(() => {
        if (!cancelled) setCanEdit(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setMainCategory(categoryParam);
  }, [categoryParam]);

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
        next.set('category', 'usage');
        if (section) {
          next.set('section', section);
        } else {
          next.delete('section');
        }
        next.delete('article');
        next.delete('role');
        next.delete('chapter');
        next.delete('q');
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
    (article: string | null, sectionForArticle?: string | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('category', 'usage');
        if (sectionForArticle) next.set('section', sectionForArticle);
        if (article) next.set('article', article);
        else next.delete('article');
        next.delete('role');
        next.delete('chapter');
        next.delete('q');
        return next;
      });
    },
    [setSearchParams],
  );

  const setCmsSearch = useCallback(
    (q: string | null) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('category', 'usage');
        next.delete('section');
        next.delete('article');
        next.delete('role');
        next.delete('chapter');
        if (q?.trim()) next.set('q', q.trim());
        else next.delete('q');
        return next;
      });
    },
    [setSearchParams],
  );

  const changeMainCategory = useCallback(
    (newCategory: MainCategory) => {
      setMainCategory(newCategory);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('category', newCategory);
        if (newCategory !== 'usage') {
          next.delete('role');
          next.delete('chapter');
          next.delete('q');
        }
        if (newCategory !== 'usage' && newCategory !== 'notice') {
          next.delete('section');
          next.delete('article');
        }
        if (newCategory === 'usage') {
          next.delete('role');
          next.delete('chapter');
          next.delete('section');
          next.delete('article');
          next.delete('q');
        }
        if (newCategory !== 'inquiry' && newCategory !== 'notice') {
          next.delete('post');
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const changeRole = useCallback(
    (newRole: HelpRole) => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('category', 'usage');
        next.set('role', newRole);
        next.delete('section');
        next.delete('article');
        next.delete('q');
        if (newRole === 'team' || newRole === 'admin') {
          next.set('chapter', HELP_WORKFLOW_CHAPTER_ID);
        } else {
          next.delete('chapter');
        }
        return next;
      });
    },
    [setSearchParams],
  );

  const showUiGallery = canEdit && searchParams.get('ui') === 'gallery';
  /** HTML 가이드는 role이 URL에 명시되고 section이 없을 때만 */
  const isTeamGuideView =
    mainCategory === 'usage' && hasRoleParam && selectedRole === 'team' && !sectionParam;
  const isAdminGuideView =
    mainCategory === 'usage' && hasRoleParam && selectedRole === 'admin' && !sectionParam;
  const isHtmlGuideView = isTeamGuideView || isAdminGuideView;
  const isCmsUsageView = mainCategory === 'usage' && !isHtmlGuideView;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <header className="sticky top-0 z-30 border-b border-slate-700 bg-slate-900 shadow-lg">
        <div className="mx-auto max-w-screen-2xl px-4 py-2.5 sm:px-6 lg:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <h1 className="text-lg font-bold tracking-tight text-white sm:text-xl">
                📚 청소비서 도움말
              </h1>
            </div>

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
        </div>
      </header>

      <div
        className={`mx-auto max-w-screen-2xl ${
          isHtmlGuideView ? 'px-2 py-3 sm:px-3 lg:px-4 lg:py-4' : 'px-4 py-6 sm:px-6 lg:px-8'
        }`}
      >
        {mainCategory === 'usage' ? (
          showUiGallery ? (
            <HelpUiGallery />
          ) : isCmsUsageView ? (
            <HelpCmsBrowseView
              tabGroup="usage"
              sectionSlug={sectionParam || null}
              articleSlug={articleParam || null}
              searchQuery={hasRoleParam ? null : cmsSearchQ || null}
              onSectionChange={setCmsSection}
              onArticleChange={setCmsArticle}
              onSearchChange={setCmsSearch}
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
          ) : null
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
