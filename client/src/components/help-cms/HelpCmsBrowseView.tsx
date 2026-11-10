import { useCallback, useEffect, useState } from 'react';
import {
  fetchPublicHelpCmsArticle,
  fetchPublicHelpCmsArticles,
  fetchPublicHelpCmsCategories,
} from '../../api/publicHelpCms';
import type { HelpCmsArticle, HelpCmsArticleListItem, HelpCmsCategory } from '../../api/platformHelpCms';
import { HelpCmsArticleCard, HelpCmsArticleReadLayout } from './HelpCmsArticleReadLayout';
import { HelpCmsArticlePublicView } from './HelpCmsArticlePublicView';
import { usePublicSeoMeta } from '../../hooks/usePublicSeoMeta';

type Props = {
  tabGroup: 'usage' | 'notice';
  sectionSlug: string | null;
  articleSlug: string | null;
  onSectionChange: (slug: string | null) => void;
  onArticleChange: (slug: string | null, sectionForArticle?: string | null) => void;
};

export function HelpCmsBrowseView({
  tabGroup,
  sectionSlug,
  articleSlug,
  onSectionChange,
  onArticleChange,
}: Props) {
  const [categories, setCategories] = useState<HelpCmsCategory[]>([]);
  const [articles, setArticles] = useState<HelpCmsArticleListItem[]>([]);
  const [homeArticlesBySlug, setHomeArticlesBySlug] = useState<
    Record<string, HelpCmsArticleListItem[]>
  >({});
  const [article, setArticle] = useState<HelpCmsArticle | null>(null);
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

  /** 기본 화면 — 분류별 글 목록을 한꺼번에 불러 카드로 보여 준다 */
  useEffect(() => {
    if (sectionSlug || categories.length === 0) {
      if (!sectionSlug) setHomeArticlesBySlug({});
      return;
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
  }, [sectionSlug, categories]);

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

  usePublicSeoMeta({
    title: article?.title ? `${article.title} | 청소비서` : '사용법 | 청소비서',
    description:
      article?.excerpt?.trim() ||
      article?.title ||
      '청소비서 사용법 — 접수·배정·정산을 화면 그대로 안내합니다.',
    robots: 'index,follow',
  });

  const activeCategory = categories.find((c) => c.slug === sectionSlug) ?? null;

  const openArticle = useCallback(
    (slug: string, categorySlug?: string) => {
      onArticleChange(slug, categorySlug ?? sectionSlug);
    },
    [onArticleChange, sectionSlug],
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

  return (
    <HelpCmsArticleReadLayout
      sidebarItems={categories.map((cat) => ({
        id: cat.id,
        label: cat.label,
        count: cat.articleCount,
        active: cat.slug === sectionSlug,
        onSelect: () => {
          onSectionChange(cat.slug);
          onArticleChange(null);
        },
      }))}
    >
      {!sectionSlug ? (
        <div className="space-y-4">
          <HelpCmsArticleCard>
            <h2 className="text-xl font-bold text-slate-900">청소비서 사용법</h2>
            <p className="mt-2 text-fluid-sm text-slate-600">
              주제를 고르면 그 분류의 글이 보입니다. 휴대폰에서는 위쪽 분류를 먼저 접어 둡니다.
            </p>
          </HelpCmsArticleCard>
          {loading && Object.keys(homeArticlesBySlug).length === 0 ? (
            <p className="py-6 text-center text-fluid-sm text-slate-500">글 목록 불러오는 중…</p>
          ) : (
            categories.map((cat) => {
              const rows = homeArticlesBySlug[cat.slug] ?? [];
              return (
                <HelpCmsArticleCard key={cat.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onSectionChange(cat.slug);
                      onArticleChange(null);
                    }}
                    className="flex w-full items-baseline justify-between gap-2 text-left"
                  >
                    <h3 className="text-lg font-bold text-slate-900">{cat.label}</h3>
                    <span className="shrink-0 text-fluid-2xs tabular-nums text-slate-400">
                      {cat.articleCount}건
                    </span>
                  </button>
                  {cat.description ? (
                    <p className="mt-1 text-fluid-sm text-slate-600">{cat.description}</p>
                  ) : null}
                  {rows.length === 0 ? (
                    <p className="mt-4 text-fluid-2xs text-slate-500">게시된 글이 없습니다.</p>
                  ) : (
                    <ul className="mt-3 divide-y divide-slate-100">
                      {rows.map((row) => (
                        <li key={row.id}>
                          <button
                            type="button"
                            onClick={() => openArticle(row.slug, cat.slug)}
                            className="flex w-full flex-col gap-0.5 rounded-lg px-1 py-2.5 text-left hover:bg-slate-50"
                          >
                            <span className="font-semibold text-slate-900">{row.title}</span>
                            {row.excerpt ? (
                              <span className="line-clamp-2 text-fluid-2xs text-slate-600">
                                {row.excerpt}
                              </span>
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </HelpCmsArticleCard>
              );
            })
          )}
        </div>
      ) : articleSlug ? (
        article ? (
          <HelpCmsArticleCard>
            <button
              type="button"
              onClick={() => onArticleChange(null)}
              className="mb-4 text-fluid-2xs text-slate-500 hover:text-slate-800"
            >
              ← {activeCategory?.label ?? '목록'}
            </button>
            <HelpCmsArticlePublicView
              title={article.title}
              publishedAt={article.publishedAt}
              coverImageUrl={article.coverImageUrl}
              contentFormat={article.contentFormat}
              bodyHtml={article.bodyHtml}
              bodyMarkdown={article.bodyMarkdown}
            />
          </HelpCmsArticleCard>
        ) : (
          <HelpCmsArticleCard>
            <p className="text-fluid-sm text-slate-500 py-8 text-center">글을 불러오는 중…</p>
          </HelpCmsArticleCard>
        )
      ) : (
        <HelpCmsArticleCard>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-lg font-bold text-slate-900">{activeCategory?.label}</h2>
            <button
              type="button"
              onClick={() => onSectionChange(null)}
              className="text-fluid-2xs text-slate-500 hover:text-slate-800"
            >
              ← 전체 분류
            </button>
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
                  <button
                    type="button"
                    onClick={() => openArticle(row.slug)}
                    className="flex w-full flex-col gap-1 rounded-lg px-2 py-3 text-left hover:bg-slate-50"
                  >
                    <span className="font-semibold text-slate-900">{row.title}</span>
                    {row.excerpt ? (
                      <span className="line-clamp-2 text-fluid-2xs text-slate-600">{row.excerpt}</span>
                    ) : null}
                    {row.publishedAt ? (
                      <span className="text-fluid-2xs text-slate-400">
                        {new Date(row.publishedAt).toLocaleDateString('ko-KR')}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </HelpCmsArticleCard>
      )}
    </HelpCmsArticleReadLayout>
  );
}
