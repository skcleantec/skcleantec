import { API } from './apiPrefix';
import type { HelpCmsArticle, HelpCmsArticleListItem, HelpCmsCategory } from './platformHelpCms';

export async function fetchPublicHelpCmsCategories(
  tabGroup: 'usage' | 'notice',
): Promise<HelpCmsCategory[]> {
  const res = await fetch(`${API}/public/help-cms/categories?tabGroup=${tabGroup}`);
  if (!res.ok) throw new Error('도움말 카테고리를 불러올 수 없습니다.');
  const data = (await res.json()) as { items: HelpCmsCategory[] };
  return data.items;
}

export async function fetchPublicHelpCmsArticles(params: {
  categorySlug: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: HelpCmsArticleListItem[]; total: number }> {
  const sp = new URLSearchParams({ categorySlug: params.categorySlug });
  if (params.limit != null) sp.set('limit', String(params.limit));
  if (params.offset != null) sp.set('offset', String(params.offset));
  const res = await fetch(`${API}/public/help-cms/articles?${sp}`);
  if (!res.ok) throw new Error('도움말 글 목록을 불러올 수 없습니다.');
  return res.json() as Promise<{ items: HelpCmsArticleListItem[]; total: number }>;
}

export async function fetchPublicHelpCmsArticle(slug: string): Promise<HelpCmsArticle> {
  const res = await fetch(`${API}/public/help-cms/articles/${encodeURIComponent(slug)}`);
  const data = (await res.json().catch(() => ({}))) as { error?: string; item?: HelpCmsArticle };
  if (!res.ok) throw new Error(data.error || '도움말 글을 불러올 수 없습니다.');
  return data.item!;
}
