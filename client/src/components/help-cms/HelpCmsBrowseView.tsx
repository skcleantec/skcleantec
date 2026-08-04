import { useCallback, useEffect, useState } from 'react';
import {
  fetchPublicHelpCmsArticle,
  fetchPublicHelpCmsArticles,
  fetchPublicHelpCmsCategories,
} from '../../api/publicHelpCms';
import type { HelpCmsArticle, HelpCmsArticleListItem, HelpCmsCategory } from '../../api/platformHelpCms';
import { HelpCmsArticleCard, HelpCmsArticleReadLayout } from './HelpCmsArticleReadLayout';
import { HelpCmsArticlePublicView } from './HelpCmsArticlePublicView';

type Props = {
  tabGroup: 'usage' | 'notice';
  sectionSlug: string | null;
  articleSlug: string | null;
  onSectionChange: (slug: string | null) => void;
  onArticleChange: (slug: string | null) => void;
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

  const activeCategory = categories.find((c) => c.slug === sectionSlug) ?? null;

  const openArticle = useCallback(
    (slug: string) => {
      onArticleChange(slug);
    },
    [onArticleChange],
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
        <HelpCmsArticleCard>
          <h2 className="text-xl font-bold text-slate-900">카테고리를 선택하세요</h2>
          <p className="mt-2 text-fluid-sm text-slate-600">왼쪽에서 주제를 고르면 글 목록이 표시됩니다.</p>
        </HelpCmsArticleCard>
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
          <h2 className="text-lg font-bold text-slate-900">{activeCategory?.label}</h2>
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
