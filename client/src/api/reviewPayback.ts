import { API } from './apiPrefix';
import { resolveInitialTenantSlug } from '../utils/tenantHostResolve';
import { resolvePublicBrandSlug } from '../utils/publicTenantQuery';

function authHeaders(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export type ReviewPaybackStatus = 'PENDING' | 'VERIFIED' | 'PAID' | 'REJECTED';

export type ReviewPaybackListItem = {
  id: string;
  orderFormId: string;
  inquiryId: string | null;
  customerName: string;
  customerPhone: string | null;
  bankName: string;
  accountNumber: string;
  accountNumberMasked: string;
  reviewImageUrl: string;
  status: ReviewPaybackStatus;
  adminMemo: string | null;
  seenAt: string | null;
  submittedAt: string;
  updatedAt: string;
  handledBy: { id: string; name: string; email: string; role: string } | null;
  orderForm: {
    id: string;
    token: string;
    reviewPaybackToken: string | null;
    customerName: string;
    customerPhone: string | null;
    createdAt: string;
  } | null;
  inquiry: {
    id: string;
    inquiryNumber: string | null;
    customerName: string;
  } | null;
};

function publicQueryString(): string {
  const slug = resolveInitialTenantSlug();
  const brand = resolvePublicBrandSlug();
  const qs = new URLSearchParams();
  if (slug) qs.set('slug', slug);
  if (brand) qs.set('brand', brand);
  const s = qs.toString();
  return s ? `?${s}` : '';
}

export async function fetchReviewPaybackPublicMeta(token: string): Promise<{
  customerName: string;
  alreadySubmitted: boolean;
  submittedAt: string | null;
}> {
  const res = await fetch(`${API}/public/review-payback/${encodeURIComponent(token)}${publicQueryString()}`);
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || '페이지 정보를 불러올 수 없습니다.');
  }
  return res.json();
}

export async function uploadReviewPaybackImage(token: string, file: File): Promise<{ url: string; publicId?: string }> {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch(
    `${API}/public/review-payback/${encodeURIComponent(token)}/upload${publicQueryString()}`,
    { method: 'POST', body: fd },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || '이미지 업로드에 실패했습니다.');
  }
  return res.json();
}

export async function submitReviewPayback(
  token: string,
  body: { bankName: string; accountNumber: string; reviewImageUrl: string; reviewImagePublicId?: string },
): Promise<{ ok: boolean; submittedAt: string }> {
  const res = await fetch(
    `${API}/public/review-payback/${encodeURIComponent(token)}/submit${publicQueryString()}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || '신청에 실패했습니다.');
  }
  return res.json();
}

export async function getReviewPaybackUnseenCount(token: string): Promise<number> {
  const res = await fetch(`${API}/review-paybacks/unseen-count`, { headers: authHeaders(token) });
  if (!res.ok) throw new Error('미확인 건수를 불러올 수 없습니다.');
  const j = (await res.json()) as { count?: number };
  return Number(j.count) || 0;
}

export async function getReviewPayback(token: string, id: string): Promise<ReviewPaybackListItem> {
  const res = await fetch(`${API}/review-paybacks/${encodeURIComponent(id)}`, { headers: authHeaders(token) });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || '상세를 불러올 수 없습니다.');
  }
  return res.json();
}

export async function listReviewPaybacks(
  token: string,
  query: Record<string, string | number | undefined>,
): Promise<{
  items: ReviewPaybackListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}> {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') qs.set(k, String(v));
  }
  const res = await fetch(`${API}/review-paybacks?${qs.toString()}`, { headers: authHeaders(token) });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || '목록을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function patchReviewPayback(
  token: string,
  id: string,
  body: { status?: ReviewPaybackStatus; adminMemo?: string | null },
): Promise<ReviewPaybackListItem> {
  const res = await fetch(`${API}/review-paybacks/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const j = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(j.error || '저장에 실패했습니다.');
  }
  return res.json();
}

export async function markReviewPaybacksSeen(token: string, ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  const res = await fetch(`${API}/review-paybacks/mark-seen-batch`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ ids }),
  });
  if (!res.ok) throw new Error('확인 처리에 실패했습니다.');
}
