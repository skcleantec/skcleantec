import { API } from './apiPrefix';

function headers(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return typeof data.error === 'string' && data.error.trim() ? data.error : '요청에 실패했습니다.';
}

export type BankDepositStatus = 'AUTO_LINKED' | 'NEEDS_REVIEW' | 'LINKED' | 'IGNORED';
export type BankDepositKind = 'DEPOSIT' | 'BALANCE' | 'TOTAL' | 'OTHER';

export type BankDepositItem = {
  id: string;
  operatingCompanyId: string | null;
  bankName: string;
  amountWon: number;
  depositorName: string;
  accountMask: string;
  depositedAt: string;
  receivedAt: string;
  status: BankDepositStatus;
  linkedInquiryId: string | null;
  linkedFollowupId: string | null;
  linkedKind: BankDepositKind | null;
  linkedAt: string | null;
  note: string | null;
  rawText: string;
};

export type BankDepositCounts = { today: number; autoLinked: number; needsReview: number; ignored: number };

export type BankDepositCandidate = {
  target: 'inquiry' | 'followup';
  id: string;
  score: number;
  kind: BankDepositKind | null;
  reasons: string[];
};

export type BankDepositDeviceItem = {
  id: string;
  name: string;
  lastSeenAt: string | null;
  appVersion: string | null;
  isActive: boolean;
  createdAt: string;
  revokedAt: string | null;
};

export type BankDepositAccountItem = {
  id: string;
  operatingCompanyId: string;
  bankName: string;
  accountMask: string;
  isActive: boolean;
  createdAt: string;
};

const base = `${API}/bank-deposits`;

export async function registerBankDepositDevice(body: {
  code: string;
  deviceName: string;
  appVersion?: string;
}): Promise<{ deviceId: string; token: string }> {
  const res = await fetch(`${base}/devices/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function ingestBankDeposits(
  deviceToken: string,
  items: { dedupeKey: string; sender?: string; text: string; receivedAt: string }[],
): Promise<{ results: { dedupeKey: string; result: 'stored' | 'duplicate' | 'skipped'; status?: BankDepositStatus }[] }> {
  const res = await fetch(`${base}/ingest`, {
    method: 'POST',
    headers: headers(deviceToken),
    body: JSON.stringify({ items }),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function heartbeatBankDepositDevice(deviceToken: string): Promise<{ serverTime: string }> {
  const res = await fetch(`${base}/heartbeat`, { method: 'POST', headers: headers(deviceToken) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function createBankDepositLinkCode(token: string): Promise<{ code: string; expiresAt: string }> {
  const res = await fetch(`${base}/devices/link-code`, { method: 'POST', headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function listBankDepositDevices(token: string): Promise<{ items: BankDepositDeviceItem[] }> {
  const res = await fetch(`${base}/devices`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function revokeBankDepositDevice(token: string, id: string): Promise<{ ok: true }> {
  const res = await fetch(`${base}/devices/${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function listBankDepositAccounts(token: string): Promise<{ items: BankDepositAccountItem[] }> {
  const res = await fetch(`${base}/accounts`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function createBankDepositAccount(
  token: string,
  body: { operatingCompanyId: string; bankName?: string; accountMask: string },
): Promise<{ id: string }> {
  const res = await fetch(`${base}/accounts`, { method: 'POST', headers: headers(token), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function updateBankDepositAccount(
  token: string,
  id: string,
  body: { operatingCompanyId?: string; bankName?: string; accountMask?: string; isActive?: boolean },
): Promise<{ ok: true }> {
  const res = await fetch(`${base}/accounts/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function deleteBankDepositAccount(token: string, id: string): Promise<{ ok: true }> {
  const res = await fetch(`${base}/accounts/${encodeURIComponent(id)}`, { method: 'DELETE', headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function listBankDeposits(
  token: string,
  query?: { date?: string; from?: string; to?: string; status?: BankDepositStatus; operatingCompanyId?: string; q?: string; limit?: number; offset?: number },
): Promise<{ items: BankDepositItem[]; counts: BankDepositCounts }> {
  const q = new URLSearchParams();
  if (query?.date) q.set('date', query.date);
  if (query?.from) q.set('from', query.from);
  if (query?.to) q.set('to', query.to);
  if (query?.status) q.set('status', query.status);
  if (query?.operatingCompanyId) q.set('operatingCompanyId', query.operatingCompanyId);
  if (query?.q) q.set('q', query.q);
  if (query?.limit != null) q.set('limit', String(query.limit));
  if (query?.offset != null) q.set('offset', String(query.offset));
  const qs = q.toString();
  const res = await fetch(`${base}${qs ? `?${qs}` : ''}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function fetchBankDepositCandidates(
  token: string,
  id: string,
): Promise<{ candidates: BankDepositCandidate[] }> {
  const res = await fetch(`${base}/${encodeURIComponent(id)}/candidates`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function linkBankDeposit(
  token: string,
  id: string,
  body: { inquiryId?: string; followupId?: string; kind: BankDepositKind },
): Promise<{ ok: true }> {
  const res = await fetch(`${base}/${encodeURIComponent(id)}/link`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function unlinkBankDeposit(token: string, id: string): Promise<{ ok: true }> {
  const res = await fetch(`${base}/${encodeURIComponent(id)}/unlink`, { method: 'POST', headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function ignoreBankDeposit(token: string, id: string, note?: string): Promise<{ ok: true }> {
  const res = await fetch(`${base}/${encodeURIComponent(id)}/ignore`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(note != null ? { note } : {}),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function fetchBankDepositsByInquiry(
  token: string,
  inquiryId: string,
): Promise<{ items: BankDepositItem[] }> {
  const res = await fetch(`${base}/by-inquiry/${encodeURIComponent(inquiryId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}
