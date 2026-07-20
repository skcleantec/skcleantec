import { API } from './apiPrefix';

const NO_STORE: RequestInit = { cache: 'no-store' };

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

function appendOperatingCompanyId(params: URLSearchParams, operatingCompanyId?: string): URLSearchParams {
  const id = operatingCompanyId?.trim();
  if (id) params.set('operatingCompanyId', id);
  return params;
}

export type ExternalCompanyListItem = {
  id: string;
  name: string;
  bizNumber: string | null;
  phone: string | null;
  memo: string | null;
  partnerUserCount: number;
  partnerUsers: Array<{ id: string; email: string; name: string; phone: string | null }>;
  linkedPartnerTenant?: { id: string; name: string; slug: string } | null;
  promotedAt?: string | null;
  usageDisabledAt?: string | null;
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
    login: { email: string; password: string; contactName?: string; phone?: string };
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
  data: {
    name?: string;
    bizNumber?: string | null;
    phone?: string | null;
    memo?: string | null;
    usageDisabled?: boolean;
  }
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

export async function listSelectableExternalCompanies(
  token: string,
): Promise<{ items: Array<{ id: string; name: string }> }> {
  const res = await fetch(`${API}/external-companies/selectable`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '타업체 목록을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function lookupExternalCompanies(
  token: string,
  ids: string[],
): Promise<{ items: Array<{ id: string; name: string; usageDisabledAt: string | null }> }> {
  const unique = [...new Set(ids.map((id) => id.trim()).filter(Boolean))];
  if (unique.length === 0) return { items: [] };
  const qs = new URLSearchParams({ ids: unique.join(',') });
  const res = await fetch(`${API}/external-companies/lookup?${qs}`, { headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '타업체 이름을 불러올 수 없습니다.');
  }
  return res.json();
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

export type MigrationEligibleInquiry = {
  id: string;
  inquiryNumber: string | null;
  customerName: string;
  preferredDate: string | null;
  status: string;
  externalTransferFee: number | null;
  operatingCompanyId: string;
};

export async function linkExternalCompanyPartnerTenant(
  token: string,
  externalCompanyId: string,
  partnerTenantId: string,
): Promise<{
  externalCompanyId: string;
  linkedPartnerTenant: { id: string; name: string; slug: string } | null;
  promotedAt: string | null;
}> {
  const res = await fetch(
    `${API}/external-companies/${encodeURIComponent(externalCompanyId)}/link-partner-tenant`,
    {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify({ partnerTenantId }),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '파트너 연결에 실패했습니다.');
  }
  return res.json();
}

export async function listExternalMigrationEligibleInquiries(
  token: string,
  externalCompanyId: string,
  operatingCompanyId?: string,
): Promise<{ items: MigrationEligibleInquiry[] }> {
  const params = new URLSearchParams();
  if (operatingCompanyId?.trim()) params.set('operatingCompanyId', operatingCompanyId.trim());
  const qs = params.toString();
  const res = await fetch(
    `${API}/external-companies/${encodeURIComponent(externalCompanyId)}/migration-eligible-inquiries${qs ? `?${qs}` : ''}`,
    { headers: headers(token), ...NO_STORE },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '이관 대상 목록을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function migrateExternalCompanyToPartner(
  token: string,
  externalCompanyId: string,
  body: { inquiryIds?: string[]; allEligible?: boolean; dryRun?: boolean },
): Promise<{
  dryRun: boolean;
  externalCompanyId: string;
  externalCompanyName: string;
  partnerTenant: { id: string; name: string; slug: string } | null;
  count: number;
  feeTotal: number;
  items: MigrationEligibleInquiry[];
  migrated: Array<{
    inquiryId: string;
    inquiryNumber: string | null;
    shareId: string;
    targetInquiryId: string;
    targetInquiryNumber: string | null;
    transferFee: number | null;
  }>;
  errors: Array<{ inquiryId: string; error: string }>;
}> {
  const res = await fetch(
    `${API}/external-companies/${encodeURIComponent(externalCompanyId)}/migrate-to-partner`,
    {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(body),
    },
  );
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || 'DB 이관에 실패했습니다.');
  }
  return res.json();
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
  to: string,
  operatingCompanyId?: string
): Promise<ExternalSettlementSummary> {
  const q = appendOperatingCompanyId(new URLSearchParams({ from, to }), operatingCompanyId).toString();
  const res = await fetch(`${API}/external-companies/settlement/summary?${q}`, {
    ...NO_STORE,
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '집계를 불러올 수 없습니다.');
  }
  return res.json();
}

export type ExternalSettlementCompanyOverviewShellRow = {
  externalCompanyId: string;
  companyName: string;
  paidAmount: number;
};

export async function getExternalSettlementCompanyOverviewShell(
  token: string,
  operatingCompanyId?: string,
): Promise<{ operatingCompanyId: string; items: ExternalSettlementCompanyOverviewShellRow[] }> {
  const q = appendOperatingCompanyId(new URLSearchParams(), operatingCompanyId).toString();
  const url = q
    ? `${API}/external-companies/settlement/company-overview-shell?${q}`
    : `${API}/external-companies/settlement/company-overview-shell`;
  const res = await fetch(url, {
    ...NO_STORE,
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '업체 정산 목록을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function getExternalSettlementCompanyOverviewPayable(
  token: string,
  operatingCompanyId?: string,
  skipCache = false,
): Promise<{ operatingCompanyId: string; fees: Record<string, number> }> {
  const params = appendOperatingCompanyId(new URLSearchParams(), operatingCompanyId);
  if (skipCache) params.set('skipCache', '1');
  const q = params.toString();
  const url = q
    ? `${API}/external-companies/settlement/company-overview-payable?${q}`
    : `${API}/external-companies/settlement/company-overview-payable`;
  const res = await fetch(url, {
    ...NO_STORE,
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '누적 정산 금액 집계에 실패했습니다.');
  }
  return res.json();
}

export async function getExternalSettlementCompanyOverviewList(
  token: string,
  operatingCompanyId?: string,
  skipCache = false,
): Promise<{ operatingCompanyId: string; items: ExternalSettlementCompanyOverviewRow[] }> {
  const params = appendOperatingCompanyId(new URLSearchParams(), operatingCompanyId);
  if (skipCache) params.set('skipCache', '1');
  const q = params.toString();
  const url = q
    ? `${API}/external-companies/settlement/company-overview-list?${q}`
    : `${API}/external-companies/settlement/company-overview-list`;
  const res = await fetch(url, {
    ...NO_STORE,
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
    viaMarketplace?: boolean;
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
    }>;
  }>;
  overall: {
    payableAmount: number;
    paidAmount: number;
    remainingAmount: number;
  };
};

export async function getExternalFeeAccruals(
  token: string,
  operatingCompanyId?: string
): Promise<ExternalFeeAccrualsResponse> {
  const q = appendOperatingCompanyId(new URLSearchParams(), operatingCompanyId).toString();
  const url = q
    ? `${API}/external-companies/settlement/accruals?${q}`
    : `${API}/external-companies/settlement/accruals`;
  const res = await fetch(url, { ...NO_STORE, headers: headers(token) });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '누계를 불러올 수 없습니다.');
  }
  return res.json();
}

export async function getExternalSettlementMonthlyOverview(
  token: string,
  params: { fromMonth: string; toMonth: string; operatingCompanyId?: string }
): Promise<ExternalSettlementMonthlyOverview> {
  const q = appendOperatingCompanyId(
    new URLSearchParams({
      fromMonth: params.fromMonth,
      toMonth: params.toMonth,
    }),
    params.operatingCompanyId
  ).toString();
  const res = await fetch(`${API}/external-companies/settlement/monthly-overview?${q}`, {
    ...NO_STORE,
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '월별 정산 요약을 불러올 수 없습니다.');
  }
  return res.json();
}

export type ExternalSettlementCompanyPaymentsResponse = {
  externalCompanyId: string;
  externalCompanyName: string | null;
  operatingCompanyId: string;
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

export async function getExternalSettlementCompanyPayments(
  token: string,
  params: {
    externalCompanyId: string;
    operatingCompanyId?: string;
    from?: string;
    to?: string;
    limit?: number;
  },
): Promise<ExternalSettlementCompanyPaymentsResponse> {
  const q = appendOperatingCompanyId(
    new URLSearchParams({ externalCompanyId: params.externalCompanyId }),
    params.operatingCompanyId,
  );
  if (params.from?.trim()) q.set('from', params.from.trim());
  if (params.to?.trim()) q.set('to', params.to.trim());
  if (params.limit != null && Number.isFinite(params.limit)) {
    q.set('limit', String(Math.min(500, Math.max(1, Math.trunc(params.limit)))));
  }
  const res = await fetch(`${API}/external-companies/settlement/company-payments?${q.toString()}`, {
    ...NO_STORE,
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '정산 지급 내역을 불러올 수 없습니다.');
  }
  return res.json();
}

export async function getExternalSettlementCompanyDetail(
  token: string,
  params: { externalCompanyId: string; from: string; to: string; search?: string; operatingCompanyId?: string }
): Promise<ExternalSettlementCompanyDetail> {
  const q = appendOperatingCompanyId(
    new URLSearchParams({
      externalCompanyId: params.externalCompanyId,
      from: params.from,
      to: params.to,
    }),
    params.operatingCompanyId
  );
  if (params.search?.trim()) q.set('search', params.search.trim());
  const res = await fetch(`${API}/external-companies/settlement/company-detail?${q.toString()}`, {
    ...NO_STORE,
    headers: headers(token),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '업체 정산 상세를 불러올 수 없습니다.');
  }
  return res.json();
}

export async function postExternalFeeAccrualReset(
  token: string,
  externalCompanyId: string,
  operatingCompanyId?: string
): Promise<void> {
  const res = await fetch(`${API}/external-companies/settlement/reset-accrual`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ externalCompanyId, operatingCompanyId: operatingCompanyId?.trim() || undefined }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { error?: string }).error || '초기화에 실패했습니다.');
  }
}

export async function postExternalSettlementPayment(
  token: string,
  params: {
    externalCompanyId: string;
    amount: number;
    memo?: string;
    paidDate?: string;
    operatingCompanyId?: string;
  }
): Promise<{ ok: boolean; payment: { id: string; amount: number; paidAt: string } }> {
  const res = await fetch(`${API}/external-companies/settlement/payments`, {
    method: 'POST',
    ...NO_STORE,
    headers: headers(token),
    body: JSON.stringify(params),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || `정산완료 처리에 실패했습니다. (HTTP ${res.status})`);
  }
  const data = (await res.json().catch(() => null)) as
    | { ok?: boolean; payment?: { id: string; amount: number; paidAt: string } }
    | null;
  if (!data?.payment?.id) {
    throw new Error('정산 응답이 올바르지 않습니다. 다시 시도하거나 담당자에게 문의하세요.');
  }
  return { ok: true, payment: data.payment };
}
