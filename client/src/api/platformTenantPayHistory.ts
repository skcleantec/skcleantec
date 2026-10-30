import { API } from './apiPrefix';
import { getPlatformToken } from '../stores/platformAuth';

function headers() {
  return { Authorization: `Bearer ${getPlatformToken() ?? ''}`, 'Content-Type': 'application/json' };
}

async function parseError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: string };
    return body.error || `요청 실패 (${res.status})`;
  } catch {
    return `요청 실패 (${res.status})`;
  }
}

export type TenantPayRow = {
  id: string;
  tenantId: string;
  merchantName: string;
  brandName: string;
  customerName: string;
  amountWon: number;
  installmentMonths: number | null;
  cardIssuer: string | null;
  cardLast4: string | null;
  cardKind: string | null;
  method: 'KEYIN' | 'CUSTOMER_LINK';
  paidSource: string | null;
  status: 'APPROVED' | 'CANCELLED';
  cancelRequested: boolean;
  paidAt: string | null;
  approvalNo: string | null;
};

export type TenantPayDetail = TenantPayRow & {
  pgOrderId: string | null;
  pgMidTail: string | null;
  inquiryId: string | null;
  inquiryNumber: string | null;
  customerPhoneMasked: string | null;
  tenantFeeLabel: string;
  platformCostLabel: string;
  platformSpreadWon: number;
  tenantNetWon: number;
  canApiCancel: boolean;
  history: { label: string; at: string; who: string; note: string }[];
};

export type TenantPayList = {
  items: TenantPayRow[];
  total: number;
  limit: number;
  offset: number;
  merchants: { id: string; name: string }[];
  summary: {
    approvedCount: number;
    approvedAmountWon: number;
    cancelledCount: number;
    cancelledAmountWon: number;
    tenantNetWon: number;
    platformSpreadWon: number;
  };
};

export type TenantPayFilter = {
  period: string;
  from: string;
  to: string;
  tenantId: string;
  method: string;
  status: string;
  q: string;
  limit: number;
  offset: number;
};

function queryOf(filter: TenantPayFilter): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filter)) {
    if (value !== '' && value != null) params.set(key, String(value));
  }
  return params.toString();
}

export async function fetchTenantPayHistory(filter: TenantPayFilter) {
  const res = await fetch(`${API}/platform/card-payment/tenant-payments?${queryOf(filter)}`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<TenantPayList>;
}

export async function fetchTenantPayDetail(id: string) {
  const res = await fetch(`${API}/platform/card-payment/tenant-payments/${encodeURIComponent(id)}`, { headers: headers() });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<TenantPayDetail>;
}

async function post(path: string, body: Record<string, unknown>) {
  const res = await fetch(`${API}/platform/card-payment/${path}`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export function cancelTenantPay(id: string, reason: string, notifyTenant: boolean) {
  return post(`tenant-payments/${encodeURIComponent(id)}/cancel`, { reason, notifyTenant });
}

export function rejectTenantPayCancel(id: string, reason: string) {
  return post(`tenant-payments/${encodeURIComponent(id)}/reject-cancel`, { reason });
}

export function markTenantPayCancelled(id: string, approvalNo: string) {
  return post(`tenant-payments/${encodeURIComponent(id)}/mark-cancelled`, { approvalNo });
}

export async function openTenantSellerCenter(id: string) {
  const res = await fetch(`${API}/platform/card-payment/tenant-payments/${encodeURIComponent(id)}/seller-center`, {
    method: 'POST',
    headers: headers(),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ loginId: string; password: string }>;
}
