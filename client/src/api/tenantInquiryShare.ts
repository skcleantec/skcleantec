import { API } from './apiPrefix';

export type TenantInquiryShareMeta = {
  id: string;
  role: 'SOURCE' | 'TARGET';
  partnerTenantId: string;
  partnerName: string;
  partnerSlug: string;
  transferFee: number | null;
  sourceInquiryNumberSnapshot: string | null;
  sharedAt: string;
  syncStatus: 'ACTIVE' | 'PAUSED' | 'REVOKED';
};

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function createTenantInquiryShare(
  token: string,
  data: { inquiryId: string; partnershipId: string; transferFee?: number | null },
): Promise<{
  share: TenantInquiryShareMeta;
  targetInquiryId: string;
  targetInquiryNumber: string | null;
}> {
  const res = await fetch(`${API}/tenant-partners/shares`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'DB 전달에 실패했습니다.');
  }
  return res.json();
}
