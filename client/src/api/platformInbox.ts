import { API } from './apiPrefix';
import { getPlatformToken } from '../stores/platformAuth';

function authHeaders() {
  return { Authorization: `Bearer ${getPlatformToken() ?? ''}`, 'Content-Type': 'application/json' };
}

export type InboxMoneyKind = 'charge' | 'deposit' | 'overdue' | 'reconcile';

export type InboxMoneyRow = {
  id: string;
  kind: InboxMoneyKind;
  tenantId: string;
  tenantName: string;
  amountKrw: number;
  depositorName: string | null;
  waitingSince: string;
  canReject: boolean;
};

export type InboxBarobillLinkRow = {
  id: string;
  tenantName: string;
  corpNumMasked: string;
  requestedAt: string;
  hint: string | null;
  contactTel: string | null;
};

export type InboxCardCancelRow = {
  id: string;
  tenantName: string;
  customerName: string;
  amountWon: number;
  reason: string;
  requestedBy: string;
  requestedAt: string;
};

export type PlatformInboxPayload = {
  money: InboxMoneyRow[];
  barobillLinks: InboxBarobillLinkRow[];
  cardCancelRequests?: InboxCardCancelRow[];
  review: {
    signup: number;
    planUpgrade: number;
    landingLink: number;
    pg: number;
    barobill: number;
  };
  pendingTotal: number;
};

async function readError(res: Response, fallback: string) {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  throw new Error(data.error ?? fallback);
}

export async function fetchPlatformInbox(): Promise<PlatformInboxPayload> {
  const res = await fetch(`${API}/platform/inbox`, { headers: authHeaders() });
  if (!res.ok) await readError(res, '오늘 할 일을 불러오지 못했습니다.');
  return res.json() as Promise<PlatformInboxPayload>;
}

export async function postPlatformInboxAction(input: {
  kind: InboxMoneyKind;
  id: string;
  tenantId: string;
  action: 'approve' | 'reject';
}): Promise<PlatformInboxPayload> {
  const res = await fetch(`${API}/platform/inbox/actions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify(input),
  });
  if (!res.ok) await readError(res, '처리하지 못했습니다.');
  const data = (await res.json()) as { inbox: PlatformInboxPayload };
  return data.inbox;
}

export async function postPlatformInboxBulkApprove(
  items: { kind: InboxMoneyKind; id: string; tenantId: string }[],
): Promise<{ inbox: PlatformInboxPayload; failed: number }> {
  const res = await fetch(`${API}/platform/inbox/actions`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ items }),
  });
  if (!res.ok) await readError(res, '일괄 승인하지 못했습니다.');
  const data = (await res.json()) as {
    inbox: PlatformInboxPayload;
    results: { ok: boolean }[];
  };
  return { inbox: data.inbox, failed: data.results.filter((row) => !row.ok).length };
}
