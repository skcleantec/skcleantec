import { API } from './apiPrefix';
import { getPlatformToken } from '../stores/platformAuth';
import type { CashbillMemberStatus } from './cashbill';

export type PlatformBarobillMemberRow = {
  id: string;
  env: string;
  status: CashbillMemberStatus;
  taxType: string | null;
  lastError: string | null;
  rejectReason: string | null;
  businessRegistrationImageUrl: string | null;
  corpName: string;
  hasUserId: boolean;
  certValid: boolean | null;
  certExpireDate: string | null;
  ntsTaxationOption?: number | null;
  ntsTaxExemptionOption?: number | null;
  ntsTaxationAddTaxAllow?: number | null;
  ntsTaxExemptionAddTaxAllow?: number | null;
  ntsAlignFailed?: boolean;
  ntsNextDayBlocked?: boolean;
  corpNumMasked: string;
  corpNum: string;
  linkRequestedAt: string | null;
  linkRequestUserIdHint: string | null;
  contactTel: string | null;
  createdAt: string;
  updatedAt: string;
  confirmNeeded: boolean;
  duplicateApplicants: { tenantName: string; status: CashbillMemberStatus }[];
  tenantName: string;
  tenantSlug: string;
  brandName: string | null;
};

function headers(): HeadersInit {
  return {
    Authorization: `Bearer ${getPlatformToken() ?? ''}`,
    'Content-Type': 'application/json',
  };
}

async function parseError(res: Response, fallback: string): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || fallback;
  } catch {
    return fallback;
  }
}

export async function fetchPlatformBarobillMembers(query: URLSearchParams): Promise<{
  items: PlatformBarobillMemberRow[];
  total: number;
}> {
  const res = await fetch(`${API}/platform/barobill/members?${query.toString()}`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, '회원사 목록을 불러오지 못했습니다.'));
  return res.json() as Promise<{ items: PlatformBarobillMemberRow[]; total: number }>;
}

export async function approvePlatformBarobillMember(id: string): Promise<void> {
  const res = await fetch(`${API}/platform/barobill/members/${id}/approve`, {
    method: 'POST',
    headers: headers(),
  });
  if (!res.ok) throw new Error(await parseError(res, '승인에 실패했습니다.'));
}

export async function rejectPlatformBarobillMember(id: string, rejectReason: string): Promise<void> {
  const res = await fetch(`${API}/platform/barobill/members/${id}/reject`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ rejectReason }),
  });
  if (!res.ok) throw new Error(await parseError(res, '반려에 실패했습니다.'));
}

export async function returnPlatformBarobillLink(id: string, reason: string): Promise<void> {
  const res = await fetch(`${API}/platform/barobill/members/${id}/link-return`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error(await parseError(res, '연결 불가로 돌려보내지 못했습니다.'));
}

export async function alignPlatformBarobillNts(id: string): Promise<void> {
  const res = await fetch(`${API}/platform/barobill/members/${id}/align-nts`, {
    method: 'POST',
    headers: headers(),
  });
  if (!res.ok) throw new Error(await parseError(res, '국세청 전송 설정을 바꾸지 못했습니다.'));
}

export async function completePlatformBarobillLink(id: string, barobillUserId: string): Promise<void> {
  const res = await fetch(`${API}/platform/barobill/members/${id}/link-complete`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ barobillUserId }),
  });
  if (!res.ok) throw new Error(await parseError(res, '처리완료에 실패했습니다.'));
}

export async function checkPlatformBarobillMember(id: string): Promise<{ isMember: boolean; message: string }> {
  const res = await fetch(`${API}/platform/barobill/members/${id}/check-member`, {
    method: 'POST',
    headers: headers(),
  });
  if (!res.ok) throw new Error(await parseError(res, '회원 여부를 확인하지 못했습니다.'));
  return res.json() as Promise<{ isMember: boolean; message: string }>;
}

export async function fetchPlatformCashbillHolds(): Promise<{ id: string; code: number; tenantName: string; tenantSlug: string; kind: string; createdAt: string }[]> {
  const res = await fetch(`${API}/platform/barobill/holds`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res, '발급 보류 알림을 불러오지 못했습니다.'));
  const body = (await res.json()) as { items: { id: string; code: number; tenantName: string; tenantSlug: string; kind: string; createdAt: string }[] };
  return body.items;
}

export async function releasePlatformBarobillProcessing(id: string): Promise<void> {
  const res = await fetch(`${API}/platform/barobill/members/${id}/release-processing`, {
    method: 'POST',
    headers: headers(),
  });
  if (!res.ok) throw new Error(await parseError(res, '검토 중으로 되돌리지 못했습니다.'));
}
