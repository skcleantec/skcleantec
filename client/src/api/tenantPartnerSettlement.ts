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
  const data = (await res.json()) as { items: TenantPartnerSettlementOverviewRow[] };
  return {
    items: data.items.map((row) => ({
      ...row,
      accruedAmount: row.payableAmount ?? row.accruedAmount,
    })),
  };
}

export type TenantPartnerSettlementMonthlyOverview = {
  role: TenantPartnerSettlementRole;
  partnerTenantId: string;
  partnerName: string;
  fromMonth: string;
  toMonth: string;
  months: Array<{
    month: string;
    payableAmount: number;
    paidAmount: number;
    remainingAmount: number;
    cumulativeRemaining: number;
  }>;
  overall: {
    payableAmount: number;
    paidAmount: number;
    remainingAmount: number;
  };
};

export async function getTenantPartnerSettlementMonthlyOverview(
  token: string,
  params: {
    role: TenantPartnerSettlementRole;
    partnerTenantId: string;
    fromMonth: string;
    toMonth: string;
  },
): Promise<TenantPartnerSettlementMonthlyOverview> {
  const q = new URLSearchParams({
    role: params.role,
    partnerTenantId: params.partnerTenantId,
    fromMonth: params.fromMonth,
    toMonth: params.toMonth,
  });
  const res = await fetch(`${API}/tenant-partners/settlement/monthly-overview?${q}`, {
    ...NO_STORE,
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '월별 정산 요약을 불러올 수 없습니다.');
  }
  return res.json();
}

export type TenantPartnerSettlementPaymentsResponse = {
  role: TenantPartnerSettlementRole;
  partnerTenantId: string;
  partnerName: string;
  from: string | null;
  to: string | null;
  payments: Array<{
    id: string;
    amount: number;
    paidAt: string;
    memo: string | null;
    actorName: string | null;
    actorRole: string | null;
  }>;
};

export async function getTenantPartnerSettlementPayments(
  token: string,
  params: {
    role: TenantPartnerSettlementRole;
    partnerTenantId: string;
    from?: string;
    to?: string;
    limit?: number;
  },
): Promise<TenantPartnerSettlementPaymentsResponse> {
  const q = new URLSearchParams({
    role: params.role,
    partnerTenantId: params.partnerTenantId,
  });
  if (params.from?.trim()) q.set('from', params.from.trim());
  if (params.to?.trim()) q.set('to', params.to.trim());
  if (params.limit != null && Number.isFinite(params.limit)) {
    q.set('limit', String(Math.min(500, Math.max(1, Math.trunc(params.limit)))));
  }
  const res = await fetch(`${API}/tenant-partners/settlement/partner-payments?${q}`, {
    ...NO_STORE,
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '정산 지급 내역을 불러올 수 없습니다.');
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
  month?: string;
  partnerName: string;
  carryOverAmount?: number;
  totalFee?: number;
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
    inquiryId?: string;
    inquiryNumber: string | null;
    customerName: string;
    signedFeeAmount: number;
    isCancelled: boolean;
    viaMarketplace?: boolean;
    settlementEffectiveDate?: string | null;
    feeAmount?: number;
    marketplaceRevenueAmount?: number | null;
    marketplaceRevenueLabel?: string | null;
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

export async function downloadTenantPartnerSettlementCsv(
  token: string,
  params: {
    role: TenantPartnerSettlementRole;
    partnerTenantId: string;
    from?: string;
    to?: string;
  },
): Promise<Blob> {
  const q = new URLSearchParams({
    role: params.role,
    partnerTenantId: params.partnerTenantId,
  });
  if (params.from) q.set('from', params.from);
  if (params.to) q.set('to', params.to);
  const res = await fetch(`${API}/tenant-partners/settlement/export?${q}`, {
    ...NO_STORE,
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'CSV보내기에 실패했습니다.');
  }
  return res.blob();
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
