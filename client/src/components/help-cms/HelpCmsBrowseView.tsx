import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  fetchPublicHelpCmsArticle,
  fetchPublicHelpCmsArticles,
  fetchPublicHelpCmsCategories,
  searchPublicHelpCms,
  type HelpCmsSearchHit,
} from '../../api/publicHelpCms';
import type { HelpCmsArticle, HelpCmsArticleListItem, HelpCmsCategory } from '../../api/platformHelpCms';
import { HelpCmsArticleCard, HelpCmsArticleReadLayout } from './HelpCmsArticleReadLayout';
import { HelpCmsArticlePublicView } from './HelpCmsArticlePublicView';
import { HelpCmsArticleFeedbackBar } from './HelpCmsArticleFeedbackBar';
import { HelpCmsHomeView } from './HelpCmsHomeView';
import { HelpCmsUsageBreadcrumb } from './HelpCmsUsageBreadcrumb';
import {
  helpUsageArticlePath,
  helpUsageHomePath,
  helpUsageSectionPath,
} from './helpCmsUsagePaths';
import { usePublicSeoMeta } from '../../hooks/usePublicSeoMeta';

type Props = {
  tabGroup: 'usage' | 'notice';
  sectionSlug: string | null;
  articleSlug: string | null;
  searchQuery: string | null;
  onSectionChange: (slug: string | null) => void;
  onArticleChange: (slug: string | null, sectionForArticle?: string | null) => void;
  onSearchChange: (q: string | null) => void;
};

export function HelpCmsBrowseView({
  tabGroup,
  sectionSlug,
  articleSlug,
  searchQuery,
  onSectionChange,
  onArticleChange,
  onSearchChange,
}: Props) {
  const navigate = useNavigate();
  const [categories, setCategories] = useState<HelpCmsCategory[]>([]);
  const [articles, setArticles] = useState<HelpCmsArticleListItem[]>([]);
  const [homeArticlesBySlug, setHomeArticlesBySlug] = useState<
    Record<string, HelpCmsArticleListItem[]>
  >({});
  const [article, setArticle] = useState<HelpCmsArticle | null>(null);
  const [searchHits, setSearchHits] = useState<HelpCmsSearchHit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPublicHelpCmsCategories(tabGroup)
      .then((items) => {
        if (!cancelled) setCategories(items);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : '불러오기 실패');
          setCategories([]);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [tabGroup]);

  useEffect(() => {
    if (sectionSlug || searchQuery || categories.length === 0) {
      if (!sectionSlug && !searchQuery) {
        /* home loads below */
      } else {
        return;
      }
    }
    let cancelled = false;
    setLoading(true);
    Promise.all(
      categories.map(async (cat) => {
        try {
          const data = await fetchPublicHelpCmsArticles({ categorySlug: cat.slug, limit: 100 });
          return [cat.slug, data.items] as const;
        } catch {
          return [cat.slug, [] as HelpCmsArticleListItem[]] as const;
        }
      }),
    )
      .then((rows) => {
        if (cancelled) return;
        const next: Record<string, HelpCmsArticleListItem[]> = {};
        for (const [slug, items] of rows) next[slug] = items;
        setHomeArticlesBySlug(next);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sectionSlug, searchQuery, categories]);

  useEffect(() => {
    if (!sectionSlug) {
      setArticles([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchPublicHelpCmsArticles({ categorySlug: sectionSlug, limit: 100 })
      .then((data) => {
        if (!cancelled) setArticles(data.items);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '목록 불러오기 실패');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [sectionSlug]);

  useEffect(() => {
    if (!articleSlug) {
      setArticle(null);
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetchPublicHelpCmsArticle(articleSlug)
      .then((item) => {
        if (!cancelled) setArticle(item);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '글 불러오기 실패');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [articleSlug]);

  useEffect(() => {
    const q = searchQuery?.trim() ?? '';
    if (!q) {
      setSearchHits([]);
      return;
    }
    let cancelled = false;
    setLoading(true);
    searchPublicHelpCms(q, 20)
      .then((items) => {
        if (!cancelled) setSearchHits(items);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : '검색 실패');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  useEffect(() => {
    if (!sectionSlug && !articleSlug && !searchQuery) return;
    window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
  }, [sectionSlug, articleSlug, searchQuery]);

  usePublicSeoMeta({
    title: article?.title
      ? `${article.title} | 청소비서`
      : searchQuery
        ? `「${searchQuery}」 검색 | 청소비서`
        : '사용법 | 청소비서',
    description:
      article?.excerpt?.trim() ||
      article?.title ||
      '청소비서 사용법 — 접수·배정·정산을 화면 그대로 안내합니다.',
    robots: 'index,follow',
  });

  const activeCategory = categories.find((c) => c.slug === sectionSlug) ?? null;

  const goInquiryPrefill = useCallback(
    (prefill: { title: string; bodyHint: string }) => {
      const sp = new URLSearchParams({
        category: 'inquiry',
        compose: '1',
        title: prefill.title,
        hint: prefill.bodyHint.slice(0, 1500),
      });
      navigate(`/help?${sp.toString()}`);
    },
    [navigate],
  );

  if (loading && categories.length === 0) {
    return <p className="text-fluid-sm text-slate-500 py-8 text-center">불러오는 중…</p>;
  }

  if (error && categories.length === 0) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-fluid-sm text-red-700">{error}</div>
    );
  }

  if (categories.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-fluid-sm text-slate-500">
        아직 게시된 도움말 카테고리가 없습니다.
      </div>
    );
  }

  const showHome = !sectionSlug && !articleSlug && !searchQuery;
  const showSearch = Boolean(searchQuery?.trim()) && !articleSlug;

  const sidebarItems = categories.map((cat) => ({
    id: cat.id,
    label: cat.label,
    slug: cat.slug,
    count: cat.articleCount,
    active: cat.slug === sectionSlug,
    href: helpUsageSectionPath(cat.slug),
  }));

  const articleSidebar =
    sectionSlug && (articles.length > 0 || loading)
      ? articles.map((row) => ({
          id: row.id,
          title: row.title,
          active: row.slug === articleSlug,
          href: helpUsageArticlePath(sectionSlug, row.slug),
        }))
      : [];

  if (showSearch) {
    return (
      <HelpCmsArticleCard>
        <HelpCmsUsageBreadcrumb />
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-900">「{searchQuery}」 검색 결과</h2>
          <Link to={helpUsageHomePath()} className="text-[14px] font-semibold text-[#0284c7] hover:underline">
            ← 사용법 홈
          </Link>
        </div>
        {loading ? (
          <p className="mt-6 text-fluid-sm text-slate-500">검색 중…</p>
        ) : searchHits.length === 0 ? (
          <div className="mt-6 space-y-3">
            <p className="text-fluid-sm text-slate-600">찾는 답이 없어요.</p>
            <button
              type="button"
              onClick={() =>
                goInquiryPrefill({
                  title: String(searchQuery ?? ''),
                  bodyHint: '어느 화면에서, 무엇을 눌렀을 때, 어떻게 됐는지 적어 주세요.',
                })
              }
              className="rounded-lg bg-slate-900 px-4 py-2 text-fluid-sm font-semibold text-white"
            >
              고객문의로 남기기
            </button>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-slate-100">
            {searchHits.map((hit) => (
              <li key={hit.slug}>
                <Link
                  to={helpUsageArticlePath(hit.categorySlug, hit.slug)}
                  className="flex w-full flex-col gap-1 rounded-lg px-2 py-3 text-left hover:bg-slate-50"
                >
                  <span className="font-semibold text-slate-900">{hit.title}</span>
                  {hit.excerpt ? (
                    <span className="line-clamp-2 text-fluid-2xs text-slate-600">{hit.excerpt}</span>
                  ) : null}
                  <span className="inline-flex w-fit rounded-full bg-sky-50 px-2 py-0.5 text-fluid-2xs font-medium text-sky-800">
                    {hit.categoryLabel}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </HelpCmsArticleCard>
    );
  }

  if (showHome) {
    return (
      <HelpCmsHomeView
        categories={categories}
        articlesBySlug={homeArticlesBySlug}
        loadingArticles={loading}
        onSearch={(q) => onSearchChange(q)}
        onOpenArticle={(section, articleSlugNext) => onArticleChange(articleSlugNext, section)}
        onOpenSection={(section) => onSectionChange(section)}
        onScrollToCategories={() => {
          document.getElementById('help-home-categories')?.scrollIntoView({ behavior: 'smooth' });
        }}
        onGoInquiry={() => navigate('/help?category=inquiry')}
        onGoNotice={() => navigate('/help?category=notice')}
      />
    );
  }

  const sectionLabel = activeCategory?.label ?? article?.categoryLabel ?? sectionSlug ?? '분류';
  const otherInSection = articles.filter((row) => row.slug !== articleSlug);
  const relatedArticles = otherInSection.slice(0, 5);
  const hasMoreRelated = otherInSection.length > 5;

  return (
    <HelpCmsArticleReadLayout
      sidebarItems={sidebarItems}
      articleItems={articleSidebar}
      articlesLoading={loading && Boolean(sectionSlug) && articles.length === 0}
      mobileSectionLabel={sectionLabel}
      mobileArticleTitle={articleSlug ? article?.title ?? null : null}
      activeSectionSlug={sectionSlug}
      activeArticleSlug={articleSlug}
      activeSectionArticles={articles}
    >
      {articleSlug ? (
        article ? (
          <HelpCmsArticleCard>
            <HelpCmsUsageBreadcrumb
              sectionSlug={sectionSlug ?? article.categorySlug}
              sectionLabel={activeCategory?.label ?? article.categoryLabel}
              articleTitle={article.title}
            />
            <HelpCmsArticlePublicView
              title={article.title}
              publishedAt={article.publishedAt}
              coverImageUrl={article.coverImageUrl}
              contentFormat={article.contentFormat}
              bodyHtml={article.bodyHtml}
              bodyMarkdown={article.bodyMarkdown}
            />
            <HelpCmsArticleFeedbackBar
              articleSlug={article.slug}
              articleTitle={article.title}
              onAskInquiry={goInquiryPrefill}
            />
            {relatedArticles.length > 0 && sectionSlug ? (
              <section className="mt-8 border-t border-slate-100 pt-5">
                <h3 className="text-fluid-sm font-bold text-slate-900">같은 분류의 다른 글</h3>
                <ul className="mt-2 space-y-0.5">
                  {relatedArticles.map((row) => (
                    <li key={row.id}>
                      <Link
                        to={helpUsageArticlePath(sectionSlug, row.slug)}
                        className="flex items-start gap-1.5 rounded-lg px-1 py-1.5 text-[15px] text-[#0369a1] hover:bg-sky-50 hover:underline"
                      >
                        <span className="shrink-0" aria-hidden>
                          →
                        </span>
                        <span className="min-w-0 truncate">{row.title}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
                {hasMoreRelated ? (
                  <Link
                    to={helpUsageSectionPath(sectionSlug)}
                    className="mt-2 inline-block text-[13px] font-semibold text-[#0284c7] hover:underline"
                  >
                    분류 전체 보기
                  </Link>
                ) : null}
              </section>
            ) : null}
          </HelpCmsArticleCard>
        ) : (
          <HelpCmsArticleCard>
            <p className="py-8 text-center text-fluid-sm text-slate-500">글을 불러오는 중…</p>
          </HelpCmsArticleCard>
        )
      ) : (
        <HelpCmsArticleCard>
          <HelpCmsUsageBreadcrumb
            sectionSlug={sectionSlug}
            sectionLabel={activeCategory?.label ?? sectionSlug}
          />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">{activeCategory?.label}</h2>
          </div>
          {activeCategory?.description ? (
            <p className="mt-1 text-fluid-sm text-slate-600">{activeCategory.description}</p>
          ) : null}
          {loading ? (
            <p className="mt-6 text-fluid-sm text-slate-500">불러오는 중…</p>
          ) : articles.length === 0 ? (
            <p className="mt-6 text-fluid-sm text-slate-500">게시된 글이 없습니다.</p>
          ) : (
            <ul className="mt-4 divide-y divide-slate-100">
              {articles.map((row) => (
                <li key={row.id}>
                  <Link
                    to={helpUsageArticlePath(sectionSlug!, row.slug)}
                    className="flex w-full flex-col gap-1 rounded-lg px-2 py-3 text-left hover:bg-sky-50"
                  >
                    <span className="text-[16px] font-bold text-slate-900">{row.title}</span>
                    {row.excerpt ? (
                      <span className="line-clamp-2 text-[13px] text-slate-500">{row.excerpt}</span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </HelpCmsArticleCard>
      )}
    </HelpCmsArticleReadLayout>
  );
}
