import { API } from './apiPrefix';
import type {
  LandingContactCustomFieldDef,
  LandingContactFormConfigDto,
  LandingContactInquiryStatus,
} from '@shared/landingContactForm';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export type LandingContactListDatePreset = 'last3months' | 'month' | 'day';

export type LandingContactInquiry = {
  id: string;
  customerName: string;
  customerPhone: string;
  content: string;
  customFieldValues: Record<string, string>;
  status: LandingContactInquiryStatus;
  source: string;
  sourcePageUrl: string | null;
  memo: string | null;
  operatingCompany: {
    id: string;
    name: string;
    slug: string;
    displayName: string;
    badgeColorKey?: string | null;
  };
  assignedTo: { id: string; name: string; role: string } | null;
  convertedBy: { id: string; name: string; role: string } | null;
  convertedAt: string | null;
  inquiry: { id: string; inquiryNumber: string | null; status: string } | null;
  createdAt: string;
  updatedAt: string;
};

export type LandingContactPublicForm = {
  title: string | null;
  introText: string | null;
  customFields: LandingContactCustomFieldDef[];
  displayName: string;
  brandSlug: string;
  isActive: boolean;
};

export async function getLandingContactFormConfigs(token: string): Promise<{ items: LandingContactFormConfigDto[] }> {
  const res = await fetch(`${API}/landing-contact/form-configs`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '문의 폼 설정을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function updateLandingContactFormConfig(
  token: string,
  operatingCompanyId: string,
  data: {
    title?: string | null;
    introText?: string | null;
    customFields?: LandingContactCustomFieldDef[];
    isActive?: boolean;
  },
): Promise<LandingContactFormConfigDto> {
  const res = await fetch(`${API}/landing-contact/form-configs/${encodeURIComponent(operatingCompanyId)}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '저장에 실패했습니다.');
  }
  return res.json();
}

export async function getLandingContactInquiries(
  token: string,
  params: {
    datePreset?: LandingContactListDatePreset;
    month?: string;
    day?: string;
    operatingCompanyId?: string;
    status?: LandingContactInquiryStatus;
    limit?: number;
    offset?: number;
  },
): Promise<{ items: LandingContactInquiry[]; total: number }> {
  const q = new URLSearchParams();
  if (params.datePreset) q.set('datePreset', params.datePreset);
  if (params.month) q.set('month', params.month);
  if (params.day) q.set('day', params.day);
  if (params.operatingCompanyId) q.set('operatingCompanyId', params.operatingCompanyId);
  if (params.status) q.set('status', params.status);
  if (params.limit != null) q.set('limit', String(params.limit));
  if (params.offset != null) q.set('offset', String(params.offset));
  const res = await fetch(`${API}/landing-contact?${q.toString()}`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '문의 목록을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function getLandingContactPendingCount(token: string): Promise<number> {
  const res = await fetch(`${API}/landing-contact/pending-count`, { headers: headers(token) });
  if (!res.ok) return 0;
  const body = (await res.json()) as { count?: number };
  return body.count ?? 0;
}

export async function patchLandingContactInquiry(
  token: string,
  id: string,
  data: { status?: LandingContactInquiryStatus; memo?: string | null },
): Promise<LandingContactInquiry> {
  const res = await fetch(`${API}/landing-contact/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '저장에 실패했습니다.');
  }
  return res.json();
}

export async function convertLandingContactInquiry(
  token: string,
  id: string,
): Promise<{ inquiryId: string; item: LandingContactInquiry }> {
  const res = await fetch(`${API}/landing-contact/${encodeURIComponent(id)}/convert`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '접수 전환에 실패했습니다.');
  }
  return res.json();
}

/** 비밀번호 확인 후 랜딩 문의 영구 삭제 */
export async function deleteLandingContactInquiry(
  token: string,
  id: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${API}/landing-contact/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(token),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '삭제에 실패했습니다.');
  }
}

export async function fetchLandingContactPublicForm(tenantSlug: string, brandSlug?: string | null): Promise<LandingContactPublicForm> {
  const q = new URLSearchParams({ tenant: tenantSlug });
  if (brandSlug?.trim()) q.set('brand', brandSlug.trim());
  const res = await fetch(`${API}/public/landing-contact/form?${q.toString()}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '문의 폼을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function submitLandingContactInquiry(payload: {
  tenantSlug: string;
  brandSlug?: string | null;
  customerName: string;
  customerPhone: string;
  content: string;
  customFieldValues?: Record<string, string>;
  sourcePageUrl?: string;
}): Promise<void> {
  const q = new URLSearchParams({ tenant: payload.tenantSlug });
  if (payload.brandSlug?.trim()) q.set('brand', payload.brandSlug.trim());
  const res = await fetch(`${API}/public/landing-contact/submit?${q.toString()}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      customerName: payload.customerName,
      customerPhone: payload.customerPhone,
      content: payload.content,
      customFieldValues: payload.customFieldValues ?? {},
      tenantSlug: payload.tenantSlug,
      sourcePageUrl: payload.sourcePageUrl ?? (typeof document !== 'undefined' ? document.referrer : undefined),
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '문의 접수에 실패했습니다.');
  }
}
