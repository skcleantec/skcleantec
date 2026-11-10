import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchPublicHelpCmsArticles } from '../../api/publicHelpCms';
import type { HelpCmsArticleListItem } from '../../api/platformHelpCms';
import type { HelpCmsSidebarItem } from './helpCmsArticleLayout';
import { helpUsageArticlePath, helpUsageHomePath, helpUsageSectionPath } from './helpCmsUsagePaths';

type Props = {
  categories: HelpCmsSidebarItem[];
  activeSectionSlug: string | null;
  activeArticleSlug: string | null;
  activeSectionArticles: HelpCmsArticleListItem[];
  activeSectionArticlesLoading?: boolean;
};

function sectionSlugFromItem(item: HelpCmsSidebarItem): string | null {
  if (item.slug) return item.slug;
  if (!item.href) return null;
  try {
    return new URL(item.href, 'https://local.invalid').searchParams.get('section');
  } catch {
    return null;
  }
}

function splitTitle(title: string): { main: string; sub: string | null } {
  const m = title.match(/^(.*?)(\s*[（(][^）)]+[）)])\s*$/u);
  if (!m) return { main: title, sub: null };
  return { main: m[1].trimEnd(), sub: m[2].trim() };
}

/** PC(lg+) 사용법 목차 — 분류 아코디언 + 글 트리 */
export function HelpCmsPcTocTree({
  categories,
  activeSectionSlug,
  activeArticleSlug,
  activeSectionArticles,
  activeSectionArticlesLoading = false,
}: Props) {
  const [expandedSlug, setExpandedSlug] = useState<string | null>(activeSectionSlug);
  const [extraArticles, setExtraArticles] = useState<HelpCmsArticleListItem[]>([]);
  const [extraLoading, setExtraLoading] = useState(false);
  const activeLinkRef = useRef<HTMLAnchorElement | null>(null);

  useEffect(() => {
    setExpandedSlug(activeSectionSlug);
  }, [activeSectionSlug]);

  useEffect(() => {
    if (!expandedSlug || expandedSlug === activeSectionSlug) {
      setExtraArticles([]);
      setExtraLoading(false);
      return;
    }
    let cancelled = false;
    setExtraLoading(true);
    fetchPublicHelpCmsArticles({ categorySlug: expandedSlug, limit: 100 })
      .then((data) => {
        if (!cancelled) setExtraArticles(data.items);
      })
      .catch(() => {
        if (!cancelled) setExtraArticles([]);
      })
      .finally(() => {
        if (!cancelled) setExtraLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [expandedSlug, activeSectionSlug]);

  useEffect(() => {
    if (!activeArticleSlug) return;
    const t = window.setTimeout(() => {
      activeLinkRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, 80);
    return () => window.clearTimeout(t);
  }, [activeArticleSlug, expandedSlug, activeSectionArticles, extraArticles]);

  const treeArticles: HelpCmsArticleListItem[] =
    expandedSlug && expandedSlug === activeSectionSlug ? activeSectionArticles : extraArticles;
  const treeLoading =
    expandedSlug && expandedSlug === activeSectionSlug
      ? activeSectionArticlesLoading
      : extraLoading;

  return (
    <aside
      className="hidden w-[260px] shrink-0 border-r border-[#e2e8f0] bg-white lg:sticky lg:top-24 lg:block lg:max-h-[calc(100dvh-8rem)] lg:overflow-y-auto lg:overscroll-y-contain [scrollbar-width:thin]"
      aria-label="사용법 목차"
    >
      <p className="px-3 pb-2 pt-1 text-[12px] font-semibold uppercase tracking-[0.04em] text-slate-500">
        사용법 목차
      </p>

      <Link
        to={helpUsageHomePath()}
        className="mx-2 mb-2 flex items-center gap-1 rounded-lg px-2 py-1.5 text-[13px] font-medium text-[#475569] hover:text-[#0284c7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0284c7]"
      >
        ← 사용법 홈
      </Link>
      <div className="mx-3 mb-2 border-b border-[#e2e8f0]" />

      <nav className="space-y-0.5 px-2 pb-4">
        {categories.map((cat) => {
          const slug = sectionSlugFromItem(cat);
          if (!slug) return null;
          const isExpanded = expandedSlug === slug;
          const isActiveSection = activeSectionSlug === slug;
          const href = cat.href ?? helpUsageSectionPath(slug);

          return (
            <div key={cat.id}>
              <div
                className={`flex h-10 items-stretch gap-0.5 rounded-lg ${
                  isActiveSection ? 'bg-[#f0f9ff]' : 'hover:bg-[#f1f5f9]'
                }`}
              >
                <button
                  type="button"
                  aria-expanded={isExpanded}
                  aria-label={isExpanded ? `${cat.label} 접기` : `${cat.label} 펼치기`}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setExpandedSlug((prev) => (prev === slug ? null : slug));
                  }}
                  className="flex w-8 shrink-0 items-center justify-center rounded-lg text-[12px] text-slate-400 hover:text-slate-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0284c7]"
                >
                  {isExpanded ? '▾' : '▸'}
                </button>
                <Link
                  to={href}
                  onClick={() => setExpandedSlug(slug)}
                  className={`flex min-w-0 flex-1 items-center justify-between gap-2 pr-2 text-left text-[15px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0284c7] ${
                    isActiveSection ? 'font-bold text-[#0369a1]' : 'font-semibold text-[#0f172a]'
                  }`}
                >
                  <span className="truncate">{cat.label}</span>
                  {cat.count != null ? (
                    <span className="shrink-0 whitespace-nowrap text-[12px] font-normal tabular-nums text-[#94a3b8]">
                      {cat.count}
                    </span>
                  ) : null}
                </Link>
              </div>

              {isExpanded ? (
                <ul className="relative ml-3 border-l border-[#e2e8f0] py-0.5">
                  {treeLoading ? (
                    <li className="py-2 pl-7 text-[12px] text-slate-400">불러오는 중…</li>
                  ) : treeArticles.length === 0 ? (
                    <li className="py-2 pl-7 text-[12px] text-slate-400">글 없음</li>
                  ) : (
                    treeArticles.map((row) => {
                      const active = row.slug === activeArticleSlug;
                      const { main, sub } = splitTitle(row.title);
                      return (
                        <li key={row.id} className="relative">
                          {active ? (
                            <span
                              className="absolute bottom-1 left-[-1px] top-1 w-0.5 rounded-full bg-[#0284c7]"
                              aria-hidden
                            />
                          ) : null}
                          <Link
                            ref={active ? activeLinkRef : undefined}
                            to={helpUsageArticlePath(slug, row.slug)}
                            aria-current={active ? 'page' : undefined}
                            className={`ml-3 flex min-h-[34px] items-start rounded-lg py-1.5 pl-4 pr-2 text-[14px] leading-[1.45] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0284c7] ${
                              active
                                ? 'bg-[#f0f9ff] font-semibold text-[#0284c7]'
                                : 'font-normal text-[#475569] hover:bg-[#f8fafc] hover:text-[#0f172a]'
                            }`}
                          >
                            <span className="line-clamp-2">
                              {main}
                              {sub ? <span className="font-normal text-[#94a3b8]">{sub}</span> : null}
                            </span>
                          </Link>
                        </li>
                      );
                    })
                  )}
                </ul>
              ) : null}
            </div>
          );
        })}
      </nav>
    </aside>
  );
}
