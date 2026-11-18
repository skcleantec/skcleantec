import { API, apiErrorMessage } from './apiPrefix';
import { getTeamToken } from '../stores/teamAuth';
import { withTeamPreviewQuery } from '../utils/teamPreviewQuery';

function headers(token: string) {
  return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
}

export class TeamTaxInvoiceError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'TeamTaxInvoiceError';
    this.code = code;
  }
}

async function readError(res: Response, fallback: string): Promise<TeamTaxInvoiceError> {
  try {
    const body = (await res.json()) as { error?: unknown; code?: unknown };
    const message = typeof body.error === 'string' && body.error.trim() ? body.error.trim() : fallback;
    return new TeamTaxInvoiceError(message, typeof body.code === 'string' ? body.code : undefined);
  } catch {
    return new TeamTaxInvoiceError(await apiErrorMessage(res, fallback));
  }
}

function tokenOrThrow(): string {
  const token = getTeamToken();
  if (!token) throw new TeamTaxInvoiceError('다시 로그인해 주세요.');
  return token;
}

export type TeamTaxBuyer = {
  bizNumber: string;
  corpName: string;
  ceoName: string;
  email: string;
  addr: string;
  bizType: string;
  bizClass: string;
};

export type TeamTaxPrefill = {
  walletBalanceKrw: number;
  unitKrw: number;
  walletShort: boolean;
  brands: { id: string; name: string; certReady: boolean; taxKind: 'taxable' | 'exempt' }[];
  buyers: TeamTaxBuyer[];
  customerName: string;
  defaultAmountWon: number;
  depositWon: number;
  totalWon: number;
  itemName: string;
  alreadyIssued: boolean;
  writeDate: string;
};

export type TeamTaxIssueResult = {
  id: string;
  totalWon: number;
  supplyWon: number;
  taxWon: number;
  buyerName: string;
  email: string;
  brandName: string;
  shareUrl: string;
  ntsSendKey: string | null;
};

export type TeamTaxMine = {
  id: string;
  customerName: string;
  inquiryNumber: string | null;
  linked: boolean;
  totalWon: number;
  status: string;
  approvalReady: boolean;
  canSendReceipt: boolean;
  canCancel: boolean;
  createdAt: string;
};

export type TeamTaxShare = {
  url: string;
  brandName: string;
  totalWon: number;
  ntsConfirmNum: string;
  phone: string;
};

export async function fetchTeamTaxAccess(): Promise<{ taxInvoiceOn: boolean }> {
  const token = tokenOrThrow();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/tax-invoices/access`), { headers: headers(token) });
  if (!res.ok) throw await readError(res, '영수증을 사용할 수 없습니다.');
  return res.json() as Promise<{ taxInvoiceOn: boolean }>;
}

export async function fetchTeamTaxPrefill(inquiryId?: string | null): Promise<TeamTaxPrefill> {
  const token = tokenOrThrow();
  const qs = inquiryId ? `?inquiryId=${encodeURIComponent(inquiryId)}` : '';
  const res = await fetch(withTeamPreviewQuery(`${API}/team/tax-invoices/prefill${qs}`), { headers: headers(token) });
  if (!res.ok) throw await readError(res, '발행 정보를 불러오지 못했습니다.');
  return res.json() as Promise<TeamTaxPrefill>;
}

export async function issueTeamTaxInvoice(body: {
  inquiryId?: string | null;
  operatingCompanyId?: string;
  amount: number;
  itemName: string;
  purposeType: 1 | 2;
  extraReason?: string;
  requestId: string;
  buyer: { corpNum: string; corpName: string; ceoName: string; addr: string; email: string; bizType?: string; bizClass?: string };
}): Promise<TeamTaxIssueResult> {
  const token = tokenOrThrow();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/tax-invoices/issues`), {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw await readError(res, '세금계산서를 발행하지 못했습니다.');
  return res.json() as Promise<TeamTaxIssueResult>;
}

export async function listMyTeamTaxInvoices(): Promise<{ items: TeamTaxMine[] }> {
  const token = tokenOrThrow();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/tax-invoices/issues`), { headers: headers(token) });
  if (!res.ok) throw await readError(res, '발행 내역을 불러오지 못했습니다.');
  return res.json() as Promise<{ items: TeamTaxMine[] }>;
}

export async function fetchTeamTaxView(id: string): Promise<{ url: string }> {
  const token = tokenOrThrow();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/tax-invoices/issues/${encodeURIComponent(id)}/view`), { headers: headers(token) });
  if (!res.ok) throw await readError(res, '영수증을 열지 못했습니다.');
  return res.json() as Promise<{ url: string }>;
}

export async function fetchTeamTaxShare(id: string): Promise<TeamTaxShare> {
  const token = tokenOrThrow();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/tax-invoices/issues/${encodeURIComponent(id)}/share`), { headers: headers(token) });
  if (!res.ok) throw await readError(res, '영수증 주소를 받지 못했습니다.');
  return res.json() as Promise<TeamTaxShare>;
}

export async function cancelTeamTaxInvoice(id: string): Promise<void> {
  const token = tokenOrThrow();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/tax-invoices/issues/${encodeURIComponent(id)}/cancel`), {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) throw await readError(res, '취소하지 못했습니다.');
}

export async function requestTeamTaxOffice(id: string): Promise<void> {
  const token = tokenOrThrow();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/tax-invoices/issues/${encodeURIComponent(id)}/office-request`), {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) throw await readError(res, '요청을 보내지 못했습니다.');
}

export async function requestTeamTaxCharge(): Promise<void> {
  const token = tokenOrThrow();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/tax-invoices/charge-request`), { method: 'POST', headers: headers(token) });
  if (!res.ok) throw await readError(res, '충전 요청을 보내지 못했습니다.');
}

export function taxInvoiceCustomerSms(input: { brandName: string; totalWon: number; ntsConfirmNum: string; url: string }): string {
  const brand = input.brandName.trim();
  const head = brand ? `${brand} 세금계산서가 발행되었습니다.` : '세금계산서가 발행되었습니다.';
  return `${head}\n금액 ${input.totalWon.toLocaleString('ko-KR')}원 · 승인번호 ${input.ntsConfirmNum}\n영수증 보기: ${input.url}`;
}

export async function requestTeamTaxCert(): Promise<void> {
  const token = tokenOrThrow();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/tax-invoices/cert-request`), { method: 'POST', headers: headers(token) });
  if (!res.ok) throw await readError(res, '등록 요청을 보내지 못했습니다.');
}
