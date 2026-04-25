import { API } from './apiPrefix';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export type ExternalCompanyListItem = {
  id: string;
  name: string;
  bizNumber: string | null;
  phone: string | null;
  memo: string | null;
  partnerUserCount: number;
  partnerUsers: Array<{ id: string; email: string; name: string; phone: string | null }>;
};

export async function listExternalCompanies(token: string): Promise<{ items: ExternalCompanyListItem[] }> {
  const res = await fetch(`${API}/external-companies`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '목록을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function createExternalCompany(
  token: string,
  data: {
    name: string;
    bizNumber?: string;
    phone?: string;
    memo?: string;
    login: { email: string; password: string; contactName: string; phone?: string };
  }
): Promise<{ company: ExternalCompanyListItem; user: { id: string; email: string; name: string } }> {
  const res = await fetch(`${API}/external-companies`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '등록에 실패했습니다.');
  }
  return res.json();
}

export async function updateExternalCompany(
  token: string,
  id: string,
  data: { name?: string; bizNumber?: string | null; phone?: string | null; memo?: string | null }
): Promise<void> {
  const res = await fetch(`${API}/external-companies/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '수정에 실패했습니다.');
  }
}

export async function deactivateExternalCompany(token: string, id: string): Promise<void> {
  const res = await fetch(`${API}/external-companies/${encodeURIComponent(id)}/deactivate`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '비활성화에 실패했습니다.');
  }
}

export type ExternalSettlementSummary = {
  from: string;
  to: string;
  rows: Array<{
    externalCompanyId: string;
    companyName: string;
    inquiryCount: number;
    cancelledInquiryCount: number;
    feeSum: number;
  }>;
  unassigned: { inquiryCount: number; cancelledInquiryCount?: number; feeSum: number } | null;
  grandTotal: number;
};

export type ExternalSettlementCompanyOverviewRow = {
  externalCompanyId: string;
  companyName: string;
  payableAmount: number;
  paidAmount: number;
  remainingAmount: number;
};

export async function getExternalSettlementSummary(
  token: string,
  from: string,
  to: string
): Promise<ExternalSettlementSummary> {
  const q = new URLSearchParams({ from, to }).toString();
  const res = await fetch(`${API}/external-companies/settlement/summary?${q}`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '집계를 불러올 수 없습니다.');
  }
  return res.json();
}

export async function getExternalSettlementCompanyOverviewList(
  token: string
): Promise<{ items: ExternalSettlementCompanyOverviewRow[] }> {
  const res = await fetch(`${API}/external-companies/settlement/company-overview-list`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '업체 정산 목록을 불러올 수 없습니다.');
  }
  return res.json();
}

export type ExternalFeeAccrualItem = {
  externalCompanyId: string;
  companyName: string;
  lastResetAt: string | null;
  sinceResetTotal: number;
  todayTotal: number;
  monthTotal: number;
  yearTotal: number;
};

export type ExternalFeeAccrualsResponse = {
  todayYmd: string;
  monthKey: string;
  year: string;
  items: ExternalFeeAccrualItem[];
};

export type ExternalSettlementCompanyDetail = {
  month: string;
  from: string;
  to: string;
  externalCompanyId: string;
  externalCompanyName: string | null;
  inquiryCount: number;
  cancelledInquiryCount: number;
  totalCount: number;
  totalFee: number;
  carryOverAmount: number;
  payableAmount: number;
  periodPaidAmount: number;
  remainingAmount: number;
  payments: Array<{
    id: string;
    amount: number;
    paidAt: string;
    memo: string | null;
    actorName: string | null;
    actorRole: string | null;
  }>;
  items: Array<{
    inquiryId: string;
    inquiryNumber: string | null;
    customerName: string;
    address: string;
    addressDetail: string | null;
    preferredDate: string | null;
    status: string;
    isCancelled: boolean;
    feeAmount: number;
    signedFeeAmount: number;
    settlementCategory: 4 | 5 | 6 | 7 | null;
  }>;
};

export type ExternalSettlementMonthlyOverview = {
  fromMonth: string;
  toMonth: string;
  months: Array<{
    month: string;
    totalPayable: number;
    totalPaid: number;
    totalRemaining: number;
    cumulativeOverallRemaining: number;
    companies: Array<{
      externalCompanyId: string;
      companyName: string;
      payableAmount: number;
      paidAmount: number;
      remainingAmount: number;
      cumulativeRemaining: number;
      categoryTotals: Array<{
        category: 4 | 5 | 6 | 7;
        payableAmount: number;
        paidAmount: number;
        remainingAmount: number;
      }>;
    }>;
  }>;
  overall: {
    payableAmount: number;
    paidAmount: number;
    remainingAmount: number;
  };
};

export async function getExternalFeeAccruals(token: string): Promise<ExternalFeeAccrualsResponse> {
  const res = await fetch(`${API}/external-companies/settlement/accruals`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '누계를 불러올 수 없습니다.');
  }
  return res.json();
}

export async function getExternalSettlementMonthlyOverview(
  token: string,
  params: { fromMonth: string; toMonth: string }
): Promise<ExternalSettlementMonthlyOverview> {
  const q = new URLSearchParams({
    fromMonth: params.fromMonth,
    toMonth: params.toMonth,
  }).toString();
  const res = await fetch(`${API}/external-companies/settlement/monthly-overview?${q}`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '월별 정산 요약을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function getExternalSettlementCompanyDetail(
  token: string,
  params: { externalCompanyId: string; from: string; to: string }
): Promise<ExternalSettlementCompanyDetail> {
  const q = new URLSearchParams({
    externalCompanyId: params.externalCompanyId,
    from: params.from,
    to: params.to,
  }).toString();
  const res = await fetch(`${API}/external-companies/settlement/company-detail?${q}`, {
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '업체 정산 상세를 불러올 수 없습니다.');
  }
  return res.json();
}

export async function postExternalFeeAccrualReset(token: string, externalCompanyId: string): Promise<void> {
  const res = await fetch(`${API}/external-companies/settlement/reset-accrual`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ externalCompanyId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '초기화에 실패했습니다.');
  }
}

export async function postExternalSettlementPayment(
  token: string,
  params: { externalCompanyId: string; amount: number; memo?: string }
): Promise<{ ok: boolean; payment: { id: string; amount: number; paidAt: string } }> {
  const res = await fetch(`${API}/external-companies/settlement/payments`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '정산완료 처리에 실패했습니다.');
  }
  return res.json();
}
