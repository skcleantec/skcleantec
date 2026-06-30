import { API } from './apiPrefix';

export type HelpInquiryCategory = {
  id: string;
  label: string;
  sortOrder: number;
};

export type HelpInquiryPublicSettings = {
  contactEmail: string;
  composeHelpText: string | null;
  categories: HelpInquiryCategory[];
};

export type HelpInquiryPost = {
  id: string;
  categoryId: string;
  categoryLabel: string;
  authorName: string;
  authorEmail: string;
  title: string;
  bodyMarkdown: string;
  imageUrls: string[];
  createdAt: string;
};

export async function fetchHelpInquirySettings(): Promise<HelpInquiryPublicSettings> {
  const res = await fetch(`${API}/help/inquiry/settings`);
  if (!res.ok) throw new Error('설정을 불러올 수 없습니다.');
  return res.json() as Promise<HelpInquiryPublicSettings>;
}

export async function fetchHelpInquiryPosts(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ items: HelpInquiryPost[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.offset != null) q.set('offset', String(params.offset));
  const res = await fetch(`${API}/help/inquiry/posts?${q}`);
  if (!res.ok) throw new Error('목록을 불러올 수 없습니다.');
  return res.json() as Promise<{ items: HelpInquiryPost[]; total: number }>;
}

export async function fetchHelpInquiryPost(id: string): Promise<HelpInquiryPost> {
  const res = await fetch(`${API}/help/inquiry/posts/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error('글을 불러올 수 없습니다.');
  return res.json() as Promise<HelpInquiryPost>;
}

export async function createHelpInquiryPost(body: {
  categoryId: string;
  authorName: string;
  authorEmail: string;
  title: string;
  bodyMarkdown: string;
  imageUrls: string[];
}): Promise<{ post: HelpInquiryPost; emailSent: boolean; emailSkipReason?: string }> {
  const res = await fetch(`${API}/help/inquiry/posts`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || '등록에 실패했습니다.');
  return data as { post: HelpInquiryPost; emailSent: boolean; emailSkipReason?: string };
}

export async function uploadHelpInquiryImage(file: File): Promise<{ url: string }> {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch(`${API}/help/inquiry/upload-image`, { method: 'POST', body: fd });
  const data = (await res.json().catch(() => ({}))) as { error?: string; url?: string };
  if (!res.ok || !data.url) throw new Error(data.error || '이미지 업로드에 실패했습니다.');
  return { url: data.url };
}
