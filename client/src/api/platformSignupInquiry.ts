import { getPlatformToken } from '../stores/platformAuth';

export type PlatformSignupInquiryStatus =
  | 'PENDING'
  | 'CONTACTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'CONVERTED'
  | 'CLOSED';

export type PlatformSignupInquiryRow = {
  id: string;
  status: PlatformSignupInquiryStatus;
  companyName: string;
  contactName: string;
  contactPhone: string;
  contactEmail: string | null;
  teamLeaderRange: string | null;
  desiredPlan: string;
  message: string;
  source: string;
  sourcePageUrl: string | null;
  adminNote: string | null;
  convertedTenantId: string | null;
  convertedTenantSlug: string | null;
  convertedTenantName: string | null;
  reviewedByName: string | null;
  createdAt: string;
  reviewedAt: string | null;
};

export type PlatformSignupInquirySettings = {
  notifyEmails: string[];
  replyToEmail: string | null;
  isActive: boolean;
  updatedAt: string;
};

const API = '/api/platform/signup-inquiries';

function headers(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export async function listPlatformSignupInquiries(
  token: string,
  params?: { status?: PlatformSignupInquiryStatus; limit?: number; offset?: number },
) {
  const q = new URLSearchParams();
  if (params?.status) q.set('status', params.status);
  if (params?.limit) q.set('limit', String(params.limit));
  if (params?.offset) q.set('offset', String(params.offset));
  const res = await fetch(`${API}?${q}`, { headers: { Authorization: `Bearer ${token}` } });
  const data = (await res.json()) as {
    items: PlatformSignupInquiryRow[];
    total: number;
    error?: string;
  };
  if (!res.ok) throw new Error(data.error ?? '조회에 실패했습니다.');
  return data;
}

export async function fetchPlatformSignupInquirySettings(token: string) {
  const res = await fetch(`${API}/settings`, { headers: { Authorization: `Bearer ${token}` } });
  const data = (await res.json()) as PlatformSignupInquirySettings & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '설정 조회에 실패했습니다.');
  return data;
}

export async function updatePlatformSignupInquirySettings(
  token: string,
  body: Partial<Pick<PlatformSignupInquirySettings, 'notifyEmails' | 'replyToEmail' | 'isActive'>>,
) {
  const res = await fetch(`${API}/settings`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as PlatformSignupInquirySettings & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '저장에 실패했습니다.');
  return data;
}

export async function updatePlatformSignupInquiryStatus(
  token: string,
  inquiryId: string,
  body: {
    status: PlatformSignupInquiryStatus;
    adminNote?: string | null;
    convertedTenantId?: string | null;
  },
) {
  const res = await fetch(`${API}/${encodeURIComponent(inquiryId)}/status`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as PlatformSignupInquiryRow & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '처리에 실패했습니다.');
  return data;
}

export function usePlatformTokenOrThrow(): string {
  const token = getPlatformToken();
  if (!token) throw new Error('플랫폼 로그인이 필요합니다.');
  return token;
}
