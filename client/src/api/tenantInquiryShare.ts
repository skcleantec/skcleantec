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
  viaMarketplace?: boolean;
  settlementMode?: 'PARTNER_NATIVE' | 'EXTERNAL_LEGACY';
  settlementExternalCompanyId?: string | null;
};

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export async function createTenantInquiryShare(
  token: string,
  data: {
    inquiryId: string;
    partnershipId: string;
    transferFee?: number | null;
    fieldPreset?: 'customer_schedule';
    fieldMask?: string[];
  },
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
    throw new Error((err as { error?: string }).error || '접수 연계에 실패했습니다.');
  }
  return res.json();
}

export async function patchTenantInquiryShareTransferFee(
  token: string,
  shareId: string,
  transferFee: number | null,
): Promise<{ share: TenantInquiryShareMeta }> {
  const res = await fetch(`${API}/tenant-partners/shares/${encodeURIComponent(shareId)}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ transferFee }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '파트너 수수료 저장에 실패했습니다.');
  }
  return res.json();
}

export async function revokeTenantInquiryShare(
  token: string,
  shareId: string,
): Promise<{ share: TenantInquiryShareMeta }> {
  const res = await fetch(`${API}/tenant-partners/shares/${encodeURIComponent(shareId)}/revoke`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '접수 연계 취소에 실패했습니다.');
  }
  return res.json();
}
