import { API, apiErrorMessage } from './apiPrefix';
import { getToken } from '../stores/auth';

export type CashbillKind = 'DEPOSIT' | 'BALANCE' | 'FULL' | 'CANCEL';

export type CashbillIssueRow = {
  id: string;
  kind: CashbillKind;
  tradeUsage: number;
  identityMasked: string;
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
  inquiryNumber?: string | null;
  customerName?: string;
  brandName?: string;
};

export type CashbillInquiryView = {
  inquiryId: string;
  inquiryNumber: string | null;
  customerName: string;
  brandId: string;
  brandName: string;
  linkState: 'unlinked' | 'simplified' | 'ready';
  linkMessage: string | null;
  settingsPath: string;
  chargePath: string;
  unitPriceKrw: number;
  walletBalanceKrw: number;
  cardPaidWon: number;
  caps: { cashCeiling: number; deposit: number; balance: number; full: number };
  issues: CashbillIssueRow[];
};

export const CASHBILL_KIND_LABEL: Record<CashbillKind, string> = {
  DEPOSIT: '예약금',
  BALANCE: '잔금',
  FULL: '전체',
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

export async function fetchInquiryCashbill(inquiryId: string): Promise<CashbillInquiryView> {
  const res = await fetch(`${API}/cashbill/inquiries/${inquiryId}`, { headers: headers() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '현금영수증을 불러오지 못했습니다.'));
  return res.json() as Promise<CashbillInquiryView>;
}

export async function issueInquiryCashbill(inquiryId: string, body: {
  kind: 'DEPOSIT' | 'BALANCE' | 'FULL';
  tradeUsage: 1 | 2;
  identity?: string;
  tradeDate?: string;
  requestId: string;
}): Promise<CashbillIssueRow> {
  const res = await fetch(`${API}/cashbill/inquiries/${inquiryId}/issue`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '현금영수증 발급에 실패했습니다.'));
  return res.json() as Promise<CashbillIssueRow>;
}

export async function cancelInquiryCashbill(inquiryId: string, issueId: string, requestId: string): Promise<CashbillIssueRow> {
  const res = await fetch(`${API}/cashbill/inquiries/${inquiryId}/cancel`, {
    method: 'POST',
    headers: headers(),
    body: JSON.stringify({ issueId, requestId }),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '현금영수증 취소에 실패했습니다.'));
  return res.json() as Promise<CashbillIssueRow>;
}

export async function copyInquiryCashbillMail(inquiryId: string, issueId: string): Promise<string> {
  const res = await fetch(`${API}/cashbill/inquiries/${inquiryId}/issues/${issueId}/mail`, {
    method: 'POST',
    headers: headers(),
  });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '확인 주소를 만들지 못했습니다.'));
  const body = (await res.json()) as { url?: string };
  return body.url ?? '';
}

export async function listCashbillIssues(qs: URLSearchParams): Promise<{
  items: CashbillIssueRow[];
  total: number;
  brands: { id: string; name: string; linked: boolean }[];
}> {
  const res = await fetch(`${API}/cashbill/issues?${qs.toString()}`, { headers: headers() });
  if (!res.ok) throw new Error(await apiErrorMessage(res, '현금영수증 목록을 불러오지 못했습니다.'));
  return res.json() as Promise<{ items: CashbillIssueRow[]; total: number; brands: { id: string; name: string; linked: boolean }[] }>;
}
