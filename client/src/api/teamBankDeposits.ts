import { API } from './apiPrefix';

function headers(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string; resolvedByName?: string | null };
  if (res.status === 409) {
    const who = typeof data.resolvedByName === 'string' && data.resolvedByName.trim() ? data.resolvedByName : '다른 사람';
    return `${who}이 이미 처리했어요.`;
  }
  return typeof data.error === 'string' && data.error.trim() ? data.error : '요청에 실패했습니다.';
}

export type TeamBankDepositOpenItem = {
  id: string;
  amountWon: number;
  depositorName: string;
  depositedAt: string;
  bankName: string;
  operatingCompanyName: string | null;
};

export type TeamBankDepositMine = {
  inquiryId: string;
  customerName: string;
  preferredDate: string | null;
  addressShort: string | null;
  balanceWon: number | null;
  amountMatch: boolean;
  hasExpectation: boolean;
};

export type TeamDepositExpectation = {
  id: string;
  depositorName: string;
  amountWon: number;
  status: 'WAITING' | 'MATCHED' | 'CANCELLED' | string;
};

export type TeamDepositMismatchReason = 'EXTRA_INCLUDED' | 'PARTIAL' | 'OTHER';

const base = `${API}/team`;

export async function fetchOpenTeamBankDeposits(token: string): Promise<{ items: TeamBankDepositOpenItem[] }> {
  const res = await fetch(`${base}/bank-deposits/open`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function fetchMyBankDepositInquiries(
  token: string,
  depositId: string,
): Promise<{ items: TeamBankDepositMine[] }> {
  const res = await fetch(`${base}/bank-deposits/${encodeURIComponent(depositId)}/my-inquiries`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function claimTeamBankDeposit(
  token: string,
  depositId: string,
  body: { inquiryId: string; kind: 'BALANCE' | 'TOTAL'; mismatchReason?: TeamDepositMismatchReason; note?: string },
): Promise<{ ok: true }> {
  const res = await fetch(`${base}/bank-deposits/${encodeURIComponent(depositId)}/claim`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function declineTeamBankDeposit(token: string, depositId: string): Promise<{ ok: true }> {
  const res = await fetch(`${base}/bank-deposits/${encodeURIComponent(depositId)}/decline`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function fetchDepositExpectation(
  token: string,
  inquiryId: string,
): Promise<{ expectation: TeamDepositExpectation | null; defaults: { depositorName: string; amountWon: number | null } }> {
  const res = await fetch(`${base}/inquiries/${encodeURIComponent(inquiryId)}/deposit-expectation`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function saveDepositExpectation(
  token: string,
  inquiryId: string,
  body: { depositorName: string; amountWon: number },
): Promise<{ expectation: TeamDepositExpectation | null }> {
  const res = await fetch(`${base}/inquiries/${encodeURIComponent(inquiryId)}/deposit-expectation`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function cancelDepositExpectation(token: string, inquiryId: string): Promise<{ ok: true }> {
  const res = await fetch(`${base}/inquiries/${encodeURIComponent(inquiryId)}/deposit-expectation`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}
