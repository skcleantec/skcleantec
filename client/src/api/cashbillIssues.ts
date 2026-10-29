import { API, apiErrorMessage } from './apiPrefix';
import { getToken } from '../stores/auth';

export type CashbillKind = 'DEPOSIT' | 'BALANCE' | 'FULL' | 'CANCEL';
export type CashbillUsage = 'phone' | 'biz' | 'voluntary';

export type CashbillIssueRow = {
  id: string;
  kind: CashbillKind;
  tradeUsage: number;
  identityMasked: string;
  itemName: string;
  totalWon: number;
  amount: number;
  tax: number;
  tradeDate: string;
  barobillState: string | null;
  ntsConfirmNum: string | null;
  chargedKrw: number;
  lastError: string | null;
  cancelOfId: string | null;
  createdAt: string;
  copyReady?: boolean;
  publicToken?: string | null;
  inquiryNumber?: string | null;
  customerName?: string;
  brandName?: string;
  canCancel?: boolean;
};

export type CashbillSearchHit = {
  id: string;
  inquiryNumber: string | null;
  customerName: string;
  customerPhone: string | null;
  brandId: string;
  brandName: string;
  linked: boolean;
  simplified: boolean;
  remainingWon: number;
  totalWon?: number;
  createdAt?: string;
};

export const CASHBILL_KIND_LABEL: Record<CashbillKind, string> = {
  DEPOSIT: '발급',
  BALANCE: '발급',
  FULL: '발급',
  CANCEL: '취소',
};

export const CASHBILL_STATE_LABEL: Record<string, string> = {
  '1000': '임시저장',
  '2000': '발급완료',
  '2500': '국세청 전송중',
  '3000': '국세청 전송완료',
  '4000': '국세청 전송실패',
  '7000': '취소완료',
};

export function cashbillStateLabel(state: string | null, lastError: string | null): string {
  if (state && CASHBILL_STATE_LABEL[state]) return CASHBILL_STATE_LABEL[state];
  if (lastError) return '실패';
  return '처리 중';
}

function headers(): HeadersInit {
  return { Authorization: `Bearer ${getToken() ?? ''}`, 'Content-Type': 'application/json' };
}

export async function searchCashbillInquiries(q: string): Promise<CashbillSearchHit[]> {
  const res = await fetch(`${API}/cashbill/inquiry-search?q=${encodeURIComponent(q)}`, { headers: headers() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '접수를 검색하지 못했습니다.'));
  const body = (await res.json()) as { items: CashbillSearchHit[] };
  return body.items;
}

export async function issueCashbill(body: {
  inquiryId?: string | null;
  operatingCompanyId?: string;
  amount: number;
  usage: CashbillUsage;
  identity?: string;
  itemName?: string;
  tradeDate?: string;
  email?: string;
  internalMemo?: string;
  requestId: string;
}): Promise<CashbillIssueRow> {
  const res = await fetch(`${API}/cashbill/issues`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '현금영수증 발급에 실패했습니다.'));
  return res.json() as Promise<CashbillIssueRow>;
}

export async function cancelCashbillIssue(issueId: string, requestId: string): Promise<CashbillIssueRow> {
  const res = await fetch(`${API}/cashbill/issues/${issueId}/cancel`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ requestId }),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '현금영수증 취소에 실패했습니다.'));
  return res.json() as Promise<CashbillIssueRow>;
}

export async function listCashbillIssues(qs: URLSearchParams): Promise<{
  items: CashbillIssueRow[];
  total: number;
  brands: { id: string; name: string; linked: boolean }[];
  summary?: { issuedCount: number; issuedWon: number; waitingCount: number; failedCount: number; costWon: number };
}> {
  const res = await fetch(`${API}/cashbill/issues?${qs.toString()}`, { headers: headers() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '현금영수증 목록을 불러오지 못했습니다.'));
  return res.json() as Promise<{ items: CashbillIssueRow[]; total: number; brands: { id: string; name: string; linked: boolean }[] }>;
}

export async function openCashbillReceipt(issueId: string): Promise<void> {
  const res = await fetch(`${API}/cashbill/issues/${issueId}/mail-url`, { headers: headers() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '영수증을 열지 못했습니다.'));
  const body = (await res.json()) as { url?: string };
  if (!body.url) throw new Error('영수증을 열지 못했습니다.');
  const opened = window.open(body.url, 'cbiseoCashbillReceipt', 'popup,width=480,height=720');
  if (!opened) throw new Error('영수증 창이 브라우저에 막혔습니다. 팝업을 허용해 주세요.');
}
