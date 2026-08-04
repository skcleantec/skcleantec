import { API } from './apiPrefix';
import { getPlatformToken } from '../stores/platformAuth';

export type HelpCmsCategory = {
  id: string;
  slug: string;
  label: string;
  description: string | null;
  tabGroup: string;
  sortOrder: number;
  isPublished: boolean;
  articleCount: number;
  createdAt: string;
  updatedAt: string;
};

export type HelpCmsArticleListItem = {
  id: string;
  categoryId: string;
  categorySlug: string;
  categoryLabel: string;
  tabGroup: string;
  slug: string;
  title: string;
  excerpt: string | null;
  coverImageUrl: string | null;
  sortOrder: number;
  isPublished: boolean;
  publishedAt: string | null;
  authorPlatformUserId: string | null;
  authorName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HelpCmsArticle = HelpCmsArticleListItem & {
  bodyHtml: string;
  bodyMarkdown: string | null;
  contentFormat: 'html' | 'markdown';
};

function headers(json = true) {
  const token = getPlatformToken();
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function fetchPlatformHelpCmsCategories(): Promise<HelpCmsCategory[]> {
  const res = await fetch(`${API}/platform/help-cms/categories`, { headers: headers() });
  if (!res.ok) throw new Error('카테고리를 불러올 수 없습니다.');
  const data = (await res.json()) as { items: HelpCmsCategory[] };
  return data.items;
}

export async function createPlatformHelpCmsCategory(body: {
  slug?: string;
  label: string;
  description?: string | null;
  tabGroup: string;
  isPublished?: boolean;
}): Promise<HelpCmsCategory> {
  const res = await fetch(`${API}/platform/help-cms/categories`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; item?: HelpCmsCategory };
  if (!res.ok) throw new Error(data.error || '저장에 실패했습니다.');
  return data.item!;
}

export async function updatePlatformHelpCmsCategory(
  id: string,
  body: Partial<{
    slug: string;
    label: string;
    description: string | null;
    tabGroup: string;
    sortOrder: number;
    isPublished: boolean;
  }>,
): Promise<HelpCmsCategory> {
  const res = await fetch(`${API}/platform/help-cms/categories/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; item?: HelpCmsCategory };
  if (!res.ok) throw new Error(data.error || '저장에 실패했습니다.');
  return data.item!;
}

export async function deletePlatformHelpCmsCategory(id: string): Promise<void> {
  const res = await fetch(`${API}/platform/help-cms/categories/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || '삭제에 실패했습니다.');
}

export async function reorderPlatformHelpCmsCategories(
  tabGroup: string,
  orderedIds: string[],
): Promise<HelpCmsCategory[]> {
  const res = await fetch(`${API}/platform/help-cms/categories/reorder`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify({ tabGroup, orderedIds }),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; items?: HelpCmsCategory[] };
  if (!res.ok) throw new Error(data.error || '순서 저장에 실패했습니다.');
  return data.items ?? [];
}

export async function fetchPlatformHelpCmsArticles(params?: {
  categoryId?: string;
  tabGroup?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: HelpCmsArticleListItem[]; total: number }> {
  const sp = new URLSearchParams();
  if (params?.categoryId) sp.set('categoryId', params.categoryId);
  if (params?.tabGroup) sp.set('tabGroup', params.tabGroup);
  if (params?.q) sp.set('q', params.q);
  if (params?.limit != null) sp.set('limit', String(params.limit));
  if (params?.offset != null) sp.set('offset', String(params.offset));
  const res = await fetch(`${API}/platform/help-cms/articles?${sp}`, { headers: headers() });
  if (!res.ok) throw new Error('글 목록을 불러올 수 없습니다.');
  return res.json() as Promise<{ items: HelpCmsArticleListItem[]; total: number }>;
}

export async function fetchPlatformHelpCmsArticle(id: string): Promise<HelpCmsArticle> {
  const res = await fetch(`${API}/platform/help-cms/articles/${encodeURIComponent(id)}`, {
    headers: headers(),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; item?: HelpCmsArticle };
  if (!res.ok) throw new Error(data.error || '글을 불러올 수 없습니다.');
  return data.item!;
}

export async function createPlatformHelpCmsArticle(body: {
  categoryId: string;
  slug?: string;
  title: string;
  excerpt?: string | null;
  coverImageUrl?: string | null;
  bodyHtml?: string;
  bodyMarkdown?: string | null;
  contentFormat?: 'html' | 'markdown';
  isPublished?: boolean;
}): Promise<HelpCmsArticle> {
  const res = await fetch(`${API}/platform/help-cms/articles`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; item?: HelpCmsArticle };
  if (!res.ok) throw new Error(data.error || '저장에 실패했습니다.');
  return data.item!;
}

export async function updatePlatformHelpCmsArticle(
  id: string,
  body: Partial<{
    categoryId: string;
    slug: string;
    title: string;
    excerpt: string | null;
    coverImageUrl: string | null;
    bodyHtml: string;
    bodyMarkdown: string | null;
    contentFormat: 'html' | 'markdown';
    isPublished: boolean;
  }>,
): Promise<HelpCmsArticle> {
  const res = await fetch(`${API}/platform/help-cms/articles/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; item?: HelpCmsArticle };
  if (!res.ok) throw new Error(data.error || '저장에 실패했습니다.');
  return data.item!;
}

export async function deletePlatformHelpCmsArticle(id: string): Promise<void> {
  const res = await fetch(`${API}/platform/help-cms/articles/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || '삭제에 실패했습니다.');
}

export async function uploadPlatformHelpCmsImage(file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(`${API}/platform/help-cms/upload-image`, {
    method: 'POST',
    headers: headers(false),
    body: fd,
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string; url?: string };
  if (!res.ok) throw new Error(data.error || '이미지 업로드에 실패했습니다.');
  return data.url!;
}
