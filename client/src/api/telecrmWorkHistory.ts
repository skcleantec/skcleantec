import { API } from './apiPrefix';

function headers(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function readError(res: Response): Promise<string> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  return typeof data.error === 'string' && data.error.trim() ? data.error : '요청에 실패했습니다.';
}

export type TelecrmWorkSource = 'soomgo' | 'miso' | 'followup' | 'lookup' | 'manual' | 'incoming_call';
export type TelecrmWorkOutcome = 'OPEN' | 'SAVED' | 'UNSAVED' | 'VIEWED';
export type TelecrmWorkLeftBy = 'switch' | 'reset' | 'close' | 'session_end';
export type TelecrmWorkSavedKind = 'requested' | 'absent' | 'hold' | 'deposit' | 'reserved' | 'received';

export type TelecrmWorkActions = {
  callCount: number;
  quoteSent: boolean;
  quoteAmountWon: number | null;
  smsCount: number;
  soomgoMessageCount: number;
  misoMessageCount: number;
  memoEdited: boolean;
  fieldsEdited: boolean;
};

/** 접수란에 보이던 값과 가격 안내 선택. 녹음·화면·키 입력은 넣지 않는다. */
export type TelecrmWorkDraft = Record<string, unknown>;

export type TelecrmWorkListItem = {
  id: string;
  userId: string;
  userName: string;
  source: TelecrmWorkSource;
  nickname: string | null;
  customerName: string | null;
  contactPhone: string | null;
  safePhone: string | null;
  actions: TelecrmWorkActions;
  outcome: TelecrmWorkOutcome;
  savedKind: TelecrmWorkSavedKind | null;
  leftBy: TelecrmWorkLeftBy | null;
  startedAt: string;
  endedAt: string | null;
  summary: string | null;
  dismissedAt: string | null;
  resumedAt: string | null;
  followupId: string | null;
  inquiryId: string | null;
  hasDraft: boolean;
};

export type TelecrmWorkDetail = TelecrmWorkListItem & { draft: TelecrmWorkDraft | null };

export type TelecrmWorkCounts = { loaded: number; saved: number; unsaved: number; viewed: number };

const base = `${API}/crm/work-history`;

export async function startTelecrmWorkEntry(
  token: string,
  body: {
    source: TelecrmWorkSource;
    operatingCompanyId?: string | null;
    nickname?: string | null;
    customerName?: string | null;
    contactPhone?: string | null;
    safePhone?: string | null;
  },
): Promise<{ id: string }> {
  const res = await fetch(base, { method: 'POST', headers: headers(token), body: JSON.stringify(body) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function patchTelecrmWorkEntry(
  token: string,
  id: string,
  body: {
    nickname?: string | null;
    customerName?: string | null;
    contactPhone?: string | null;
    safePhone?: string | null;
    actions?: Partial<TelecrmWorkActions>;
    draft?: TelecrmWorkDraft | null;
    summary?: string | null;
  },
): Promise<{ ok: true }> {
  const res = await fetch(`${base}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function finishTelecrmWorkEntry(
  token: string,
  id: string,
  body: {
    outcome: 'SAVED' | 'UNSAVED' | 'VIEWED';
    savedKind?: TelecrmWorkSavedKind | null;
    leftBy?: TelecrmWorkLeftBy | null;
    followupId?: string | null;
    inquiryId?: string | null;
    draft?: TelecrmWorkDraft | null;
    summary?: string | null;
  },
  opts?: { keepalive?: boolean },
): Promise<{ ok: true }> {
  const res = await fetch(`${base}/${encodeURIComponent(id)}/finish`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
    keepalive: opts?.keepalive === true,
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function dismissTelecrmWorkEntry(token: string, id: string): Promise<{ ok: true }> {
  const res = await fetch(`${base}/${encodeURIComponent(id)}/dismiss`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function resumeTelecrmWorkEntry(
  token: string,
  id: string,
): Promise<{ draft: TelecrmWorkDraft | null }> {
  const res = await fetch(`${base}/${encodeURIComponent(id)}/resume`, {
    method: 'POST',
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function listTelecrmWorkEntries(
  token: string,
  query?: { date?: string; userId?: string; outcome?: TelecrmWorkOutcome; limit?: number; offset?: number },
): Promise<{ date: string; items: TelecrmWorkListItem[]; counts: TelecrmWorkCounts }> {
  const q = new URLSearchParams();
  if (query?.date) q.set('date', query.date);
  if (query?.userId) q.set('userId', query.userId);
  if (query?.outcome) q.set('outcome', query.outcome);
  if (query?.limit != null) q.set('limit', String(query.limit));
  if (query?.offset != null) q.set('offset', String(query.offset));
  const qs = q.toString();
  const res = await fetch(`${base}${qs ? `?${qs}` : ''}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function fetchTelecrmWorkEntry(token: string, id: string): Promise<{ item: TelecrmWorkDetail }> {
  const res = await fetch(`${base}/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function fetchTelecrmUnsavedWorkCount(token: string): Promise<{ count: number }> {
  const res = await fetch(`${base}/unsaved-count`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}

export async function fetchTelecrmWorkSummary(
  token: string,
  date?: string,
): Promise<{
  date: string;
  items: Array<{ userId: string; userName: string; loaded: number; saved: number; unsaved: number; viewed: number }>;
}> {
  const q = date ? `?date=${encodeURIComponent(date)}` : '';
  const res = await fetch(`${base}/summary${q}`, { headers: { Authorization: `Bearer ${token}` } });
  if (!res.ok) throw new Error(await readError(res));
  return res.json();
}
