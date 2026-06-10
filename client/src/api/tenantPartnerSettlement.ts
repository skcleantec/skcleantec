import { API } from './apiPrefix';

const NO_STORE: RequestInit = { cache: 'no-store' };

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export type TenantPartnerSettlementRole = 'SELLER' | 'BUYER';

export type TenantPartnerSettlementOverviewRow = {
  partnerTenantId: string;
  partnerName: string;
  partnerSlug: string;
  partnershipId: string;
  /** SELLER: payableAmount alias, BUYER: accruedAmount */
  accruedAmount: number;
  payableAmount?: number;
  paidAmount: number;
  remainingAmount: number;
};

export async function getTenantPartnerSellerSummary(
  token: string,
): Promise<{ items: TenantPartnerSettlementOverviewRow[] }> {
  const res = await fetch(`${API}/tenant-partners/settlement/seller-summary`, {
    ...NO_STORE,
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '판매 정산 목록을 불러올 수 없습니다.');
  }
  const data = (await res.json()) as { items: TenantPartnerSettlementOverviewRow[] };
  return {
    items: data.items.map((row) => ({
      ...row,
      accruedAmount: row.payableAmount ?? row.accruedAmount,
    })),
  };
}

export async function getTenantPartnerBuyerSummary(
  token: string,
): Promise<{ items: TenantPartnerSettlementOverviewRow[] }> {
  const res = await fetch(`${API}/tenant-partners/settlement/buyer-summary`, {
    ...NO_STORE,
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '구매 정산 목록을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function getTenantPartnerSettlementDetail(
  token: string,
  params: {
    role: TenantPartnerSettlementRole;
    partnerTenantId: string;
    from?: string;
    to?: string;
  },
): Promise<{
  role: TenantPartnerSettlementRole;
  partnerName: string;
  remainingAmount: number;
  payableAmount: number;
  periodPaidAmount: number;
  payments: Array<{
    id: string;
    amount: number;
    paidAt: string;
    memo: string | null;
    actorName: string | null;
  }>;
  items: Array<{
    shareId: string;
    inquiryNumber: string | null;
    customerName: string;
    signedFeeAmount: number;
    isCancelled: boolean;
  }>;
}> {
  const q = new URLSearchParams({
    role: params.role,
    partnerTenantId: params.partnerTenantId,
  });
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  const res = await fetch(`${API}/tenant-partners/settlement/partner-detail?${q}`, {
    ...NO_STORE,
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '정산 상세를 불러올 수 없습니다.');
  }
  return res.json();
}

export async function postTenantPartnerSettlementPayment(
  token: string,
  data: {
    partnerTenantId: string;
    role: TenantPartnerSettlementRole;
    amount: number;
    memo?: string;
    paidDate?: string;
  },
): Promise<{ payment: { id: string; amount: number; paidAt: string } }> {
  const res = await fetch(`${API}/tenant-partners/settlement/payments`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '정산 처리에 실패했습니다.');
  }
  return res.json();
}
