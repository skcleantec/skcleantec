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
  brands: { id: string; name: string }[];
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
};

export type TeamCashbillMine = {
  id: string;
  customerName: string;
  inquiryNumber: string | null;
  linked: boolean;
  totalWon: number;
  identityMasked: string;
  ntsConfirmNum: string | null;
  status: string;
  canRequestCancel: boolean;
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

export async function requestTeamCashbillCancel(id: string): Promise<void> {
  const token = tokenOrThrow();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/cashbill/issues/${encodeURIComponent(id)}/cancel-request`), {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) throw await readError(res, '취소 요청을 보내지 못했습니다.');
}

export async function requestTeamCashbillCharge(): Promise<void> {
  const token = tokenOrThrow();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/cashbill/charge-request`), {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) throw await readError(res, '충전 요청을 보내지 못했습니다.');
}
