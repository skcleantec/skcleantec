import { API, apiErrorMessage } from './apiPrefix';
import { getTeamToken } from '../stores/teamAuth';
import { withTeamPreviewQuery } from '../utils/teamPreviewQuery';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export class TeamCashbillError extends Error {
  code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.name = 'TeamCashbillError';
    this.code = code;
  }
}

async function readError(res: Response, fallback: string): Promise<TeamCashbillError> {
  try {
    const body = (await res.json()) as { error?: unknown; code?: unknown };
    const message = typeof body.error === 'string' && body.error.trim() ? body.error.trim() : fallback;
    return new TeamCashbillError(message, typeof body.code === 'string' ? body.code : undefined);
  } catch {
    return new TeamCashbillError(await apiErrorMessage(res, fallback));
  }
}

export type TeamCashbillPrefill = {
  walletShort: boolean;
  walletBalanceKrw: number;
  unitKrw: number;
  depositWon: number;
  brands: { id: string; name: string; taxType: string | null }[];
  defaultTaxKind: 'taxable' | 'exempt';
  issueTaxType: string | null;
  customerName: string;
  customerPhone: string;
  defaultAmountWon: number;
  totalWon: number;
  remainingWon: number;
  alreadyIssued: boolean;
};

export type TeamCashbillIssueResult = {
  id: string;
  ntsConfirmNum: string | null;
  totalWon: number;
  customerName: string;
  phone: string;
  warning: string | null;
  brandName: string;
  shareUrl: string;
};

export type TeamCashbillShare = {
  url: string;
  brandName: string;
  totalWon: number;
  ntsConfirmNum: string;
  phone: string;
};

export function cashbillCustomerSms(input: { brandName: string; totalWon: number; ntsConfirmNum: string; url: string }): string {
  const brand = input.brandName.trim();
  const head = brand ? `${brand} 현금영수증이 발행되었습니다.` : '현금영수증이 발행되었습니다.';
  return `${head}\n금액 ${input.totalWon.toLocaleString('ko-KR')}원 · 승인번호 ${input.ntsConfirmNum}\n영수증 보기: ${input.url}`;
}

export type TeamCashbillMine = {
  id: string;
  customerName: string;
  inquiryNumber: string | null;
  linked: boolean;
  totalWon: number;
  identityMasked: string;
  usageLabel: string;
  taxKind: 'taxable' | 'exempt';
  ntsConfirmNum: string | null;
  status: string;
  canCancel: boolean;
  canSendReceipt: boolean;
  createdAt: string;
  lastError: string | null;
};

function tokenOrThrow(): string {
  const token = getTeamToken();
  if (!token) throw new TeamCashbillError('다시 로그인해 주세요.');
  return token;
}

export async function fetchTeamCashbillPrefill(inquiryId?: string | null): Promise<TeamCashbillPrefill> {
  const token = tokenOrThrow();
  const qs = inquiryId ? `?inquiryId=${encodeURIComponent(inquiryId)}` : '';
  const res = await fetch(withTeamPreviewQuery(`${API}/team/cashbill/prefill${qs}`), { headers: headers(token) });
  if (!res.ok) throw await readError(res, '발행 정보를 불러오지 못했습니다.');
  return res.json() as Promise<TeamCashbillPrefill>;
}

export async function issueTeamCashbill(body: {
  inquiryId?: string | null;
  operatingCompanyId?: string;
  amount: number;
  identity: string;
  customerName: string;
  usage: 'phone' | 'biz';
  taxKind: 'taxable' | 'exempt';
  extraReason?: string;
  requestId: string;
}): Promise<TeamCashbillIssueResult> {
  const token = tokenOrThrow();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/cashbill/issues`), {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await readError(res, '현금영수증을 발행하지 못했습니다.');
  return res.json() as Promise<TeamCashbillIssueResult>;
}

export async function listMyTeamCashbill(): Promise<{ items: TeamCashbillMine[] }> {
  const token = tokenOrThrow();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/cashbill/issues`), { headers: headers(token) });
  if (!res.ok) throw await readError(res, '발행 내역을 불러오지 못했습니다.');
  return res.json() as Promise<{ items: TeamCashbillMine[] }>;
}

export async function fetchTeamCashbillView(id: string): Promise<{ url: string }> {
  const token = tokenOrThrow();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/cashbill/issues/${encodeURIComponent(id)}/view`), {
    headers: headers(token),
  });
  if (!res.ok) throw await readError(res, '영수증을 열지 못했습니다.');
  return res.json() as Promise<{ url: string }>;
}

export async function fetchTeamCashbillShare(id: string): Promise<TeamCashbillShare> {
  const token = tokenOrThrow();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/cashbill/issues/${encodeURIComponent(id)}/share`), {
    headers: headers(token),
  });
  if (!res.ok) throw await readError(res, '영수증 주소를 받지 못했습니다.');
  return res.json() as Promise<TeamCashbillShare>;
}

export function receiptShareText(input: { brandName: string; label: string; totalWon: number }): string {
  const brand = input.brandName.trim();
  const amount = `${input.totalWon.toLocaleString('ko-KR')}원`;
  return brand ? `[${brand}] ${input.label} · ${amount}` : `${input.label} · ${amount}`;
}

export async function shareReceiptLink(input: { brandName: string; label: string; totalWon: number; url: string }): Promise<'shared' | 'copied'> {
  const payload = { title: input.label, text: receiptShareText(input), url: input.url };
  if (typeof navigator.share === 'function') {
    try {
      await navigator.share(payload);
      return 'shared';
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return 'shared';
    }
  }
  await navigator.clipboard.writeText(input.url);
  return 'copied';
}

export async function cancelTeamCashbill(id: string): Promise<void> {
  const token = tokenOrThrow();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/cashbill/issues/${encodeURIComponent(id)}/cancel-request`), {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ requestId: crypto.randomUUID().replace(/-/g, '').slice(0, 20) }),
  });
  if (!res.ok) throw await readError(res, '취소하지 못했습니다.');
}

export async function requestTeamCashbillCharge(): Promise<void> {
  const token = tokenOrThrow();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/cashbill/charge-request`), {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) throw await readError(res, '충전 요청을 보내지 못했습니다.');
}
