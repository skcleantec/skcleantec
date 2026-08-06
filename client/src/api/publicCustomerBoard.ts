import { API } from './apiPrefix';
import { getToken } from '../stores/auth';
import type { PlatformBoardPost, PlatformBoardPostStatus, PlatformBoardType } from './platformCustomerBoard';

export type PublicCustomerBoardSettings = {
  slug: string;
  label: string;
  boardType: PlatformBoardType;
  listPublic: boolean;
  contactEmail: string;
  composeHelpText: string | null;
  categories: { id: string; slug: string; label: string; sortOrder: number }[];
};

function authHeaders(json = true): Record<string, string> {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  const token = getToken();
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

export async function fetchPublicCustomerBoardSettings(slug: string): Promise<PublicCustomerBoardSettings> {
  const res = await fetch(`${API}/public/customer-boards/boards/${encodeURIComponent(slug)}/settings`);
  if (!res.ok) throw new Error('설정을 불러오지 못했습니다.');
  return res.json() as Promise<PublicCustomerBoardSettings>;
}

export async function fetchPublicCustomerBoardPosts(params: {
  boardSlug: string;
  categorySlug?: string;
  q?: string;
  limit?: number;
  offset?: number;
}): Promise<{ items: PlatformBoardPost[]; total: number }> {
  const sp = new URLSearchParams();
  if (params.categorySlug) sp.set('category', params.categorySlug);
  if (params.q) sp.set('q', params.q);
  sp.set('limit', String(params.limit ?? 10));
  sp.set('offset', String(params.offset ?? 0));
  const res = await fetch(
    `${API}/public/customer-boards/boards/${encodeURIComponent(params.boardSlug)}/posts?${sp}`,
  );
  if (!res.ok) throw new Error('목록을 불러오지 못했습니다.');
  return res.json() as Promise<{ items: PlatformBoardPost[]; total: number }>;
}

export async function fetchPublicCustomerBoardPost(params: {
  boardSlug: string;
  postId: string;
  accessEmail?: string;
}): Promise<PlatformBoardPost> {
  const sp = new URLSearchParams();
  if (params.accessEmail) sp.set('accessEmail', params.accessEmail);
  const res = await fetch(
    `${API}/public/customer-boards/boards/${encodeURIComponent(params.boardSlug)}/posts/${encodeURIComponent(params.postId)}?${sp}`,
    { headers: authHeaders(false) },
  );
  if (!res.ok) throw new Error('글을 불러오지 못했습니다.');
  const data = (await res.json()) as { post: PlatformBoardPost };
  return data.post;
}

export async function createPublicCustomerInquiryPost(
  boardSlug: string,
  body: {
    categoryId: string;
    authorName: string;
    authorEmail: string;
    title: string;
    bodyHtml: string;
    isSecret?: boolean;
  },
): Promise<{ post: PlatformBoardPost; emailSent: boolean }> {
  const res = await fetch(`${API}/public/customer-boards/boards/${encodeURIComponent(boardSlug)}/posts`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error ?? '등록에 실패했습니다.');
  }
  return res.json() as Promise<{ post: PlatformBoardPost; emailSent: boolean }>;
}

export async function uploadPublicCustomerBoardImage(boardSlug: string, file: File): Promise<string> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch(
    `${API}/public/customer-boards/boards/${encodeURIComponent(boardSlug)}/upload`,
    { method: 'POST', headers: authHeaders(false), body: fd },
  );
  if (!res.ok) throw new Error('이미지 업로드에 실패했습니다.');
  const data = (await res.json()) as { url: string };
  return data.url;
}

export type { PlatformBoardPost, PlatformBoardPostStatus };
