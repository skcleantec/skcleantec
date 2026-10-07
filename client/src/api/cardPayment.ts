import { API } from './apiPrefix';
import type { CardPaymentFeeBreakdown, CardPaymentMethod, CardPaymentStatus } from '@shared/cardPayment';

function headers(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export type CardPaymentRow = {
  id: string;
  inquiryId: string | null;
  inquiryNumber: string | null;
  method: CardPaymentMethod;
  status: CardPaymentStatus;
  amountWon: number;
  tenantFeeBps: number;
  platformCostBps: number;
  tenantFeeWon: number;
  platformCostWon: number;
  platformSpreadWon: number;
  tenantNetWon: number;
  customerName: string;
  customerPhoneMasked: string | null;
  cardLast4: string | null;
  approvalNo: string | null;
  pgOrderId: string | null;
  paidAt: string | null;
  failReason: string | null;
  createdAt: string;
  createdBy: { id: string; name: string };
};

export type CardPaymentListResponse = {
  total: number;
  items: CardPaymentRow[];
  summary: {
    approvedCount: number;
    amountWon: number;
    tenantFeeWon: number;
    platformCostWon: number;
    platformSpreadWon: number;
    tenantNetWon: number;
  };
};

export type PgOnboardingRow = {
  id: string;
  status: string;
  businessName: string | null;
  bizNumber: string | null;
  representativeName: string | null;
  representativeBirth: string | null;
  addressLine: string | null;
  contactName: string | null;
  contactPhone: string | null;
  contactEmail: string | null;
  bankName: string | null;
  bankAccount: string | null;
  accountHolder: string | null;
  websiteUrl: string | null;
  note: string | null;
  submittedAt: string | null;
  forwardedAt: string | null;
  decidedAt: string | null;
  platformMemo: string | null;
  updatedAt: string;
};

async function parseError(res: Response): Promise<string> {
  try {
    const j = (await res.json()) as { error?: string };
    return j.error || `요청 실패 (${res.status})`;
  } catch {
    return `요청 실패 (${res.status})`;
  }
}

export async function fetchCardPaymentQuote(token: string, amountWon: number): Promise<CardPaymentFeeBreakdown> {
  const res = await fetch(`${API}/card-payments/quote?amount=${encodeURIComponent(String(amountWon))}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchCardPaymentPrefill(token: string, inquiryId: string) {
  const res = await fetch(`${API}/card-payments/inquiry/${encodeURIComponent(inquiryId)}/prefill`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{
    inquiryId: string;
    inquiryNumber: string | null;
    customerName: string;
    amountWon: number;
    quote: CardPaymentFeeBreakdown;
    pgConnected: boolean;
  }>;
}

export async function fetchCardPaymentList(
  token: string,
  query: Record<string, string | number | undefined>,
): Promise<CardPaymentListResponse> {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== '') q.set(k, String(v));
  }
  const res = await fetch(`${API}/card-payments?${q}`, { headers: headers(token) });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json();
}

export async function fetchTenantPgState(token: string) {
  const res = await fetch(`${API}/card-payments/pg`, { headers: headers(token) });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{
    onboarding: PgOnboardingRow;
    credential:
      | { connected: false }
      | {
          connected: true;
          isActive: boolean;
          apiKeyLast4: string;
          tidMasked: string;
          mid: string | null;
          oid: string | null;
          connectedAt: string;
        };
  }>;
}

export async function saveTenantPgOnboarding(token: string, body: Partial<PgOnboardingRow>) {
  const res = await fetch(`${API}/card-payments/pg/onboarding`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<PgOnboardingRow>;
}

export async function submitTenantPgOnboarding(token: string, body: Partial<PgOnboardingRow>) {
  const res = await fetch(`${API}/card-payments/pg/onboarding/submit`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<PgOnboardingRow>;
}

export async function createCardPayment(
  token: string,
  body: { inquiryId: string; amountWon: number; method: CardPaymentMethod | 'PAY_WINDOW'; payScreen?: 'P' | 'M' },
) {
  const res = await fetch(`${API}/card-payments`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ payment: CardPaymentRow }>;
}

export async function confirmCardPaymentWindow(token: string, id: string, payScreen: 'P' | 'M') {
  const res = await fetch(`${API}/card-payments/${encodeURIComponent(id)}/window`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ payScreen }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ payment: CardPaymentRow; pgReady: boolean; redirectUrl: string }>;
}

export async function openPublicPaysisWindow(token: string, payScreen: 'P' | 'M') {
  const res = await fetch(`${API}/public/card-payment/link/${encodeURIComponent(token)}/window`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ payScreen }),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{ redirectUrl: string }>;
}

export async function confirmCardPaymentKeyin(token: string, id: string) {
  const res = await fetch(`${API}/card-payments/${encodeURIComponent(id)}/keyin`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{
    payment: CardPaymentRow;
    pgReady: boolean;
    pgWindowUrl: string;
    pgMessage: string | null;
  }>;
}

export async function confirmCardPaymentLink(token: string, id: string) {
  const res = await fetch(`${API}/card-payments/${encodeURIComponent(id)}/link`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{
    payment: CardPaymentRow;
    linkUrl: string;
    linkPath: string;
    pgCheckoutUrl: string | null;
    pgWindowUrl: string;
    pgMessage: string | null;
  }>;
}

export async function fetchPublicCardPaymentLink(token: string) {
  const res = await fetch(`${API}/public/card-payment/link/${encodeURIComponent(token)}`);
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<{
    customerName: string;
    amountWon: number;
    status: CardPaymentStatus;
    tenantName: string;
    inquiryNumber: string | null;
    paidAt: string | null;
    pgWindowUrl: string;
  }>;
}
