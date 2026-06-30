import { API } from './apiPrefix';
import { getPlatformToken } from '../stores/platformAuth';
import type { HelpInquiryCategory, HelpInquiryPost } from './helpInquiry';

export type HelpInquiryPlatformSettings = {
  contactEmail: string;
  notifyEmail: string;
  composeHelpText: string | null;
  categories: HelpInquiryCategory[];
};

function headers() {
  const token = getPlatformToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

export async function fetchPlatformHelpInquirySettings(): Promise<HelpInquiryPlatformSettings> {
  const res = await fetch(`${API}/platform/help-inquiry/settings`, { headers: headers() });
  if (!res.ok) throw new Error('설정을 불러올 수 없습니다.');
  return res.json() as Promise<HelpInquiryPlatformSettings>;
}

export async function updatePlatformHelpInquirySettings(
  body: Partial<HelpInquiryPlatformSettings>,
): Promise<HelpInquiryPlatformSettings> {
  const res = await fetch(`${API}/platform/help-inquiry/settings`, {
    method: 'PATCH',
    headers: headers(),
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || '저장에 실패했습니다.');
  return data as HelpInquiryPlatformSettings;
}

export async function fetchPlatformHelpInquiryPosts(params?: {
  limit?: number;
  offset?: number;
}): Promise<{ items: HelpInquiryPost[]; total: number }> {
  const q = new URLSearchParams();
  if (params?.limit != null) q.set('limit', String(params.limit));
  if (params?.offset != null) q.set('offset', String(params.offset));
  const res = await fetch(`${API}/platform/help-inquiry/posts?${q}`, { headers: headers() });
  if (!res.ok) throw new Error('목록을 불러올 수 없습니다.');
  return res.json() as Promise<{ items: HelpInquiryPost[]; total: number }>;
}
