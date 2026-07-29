import type { HouseholdLedgerListResponse } from './teamHouseholdLedger';
import { API } from './apiPrefix';
import { AuthSessionExpiredError } from './auth';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export type AdminHouseholdLedgerTeamLeader = {
  id: string;
  name: string | null;
  email: string | null;
};

export type AdminHouseholdLedgerListResponse = HouseholdLedgerListResponse & {
  teamLeader: AdminHouseholdLedgerTeamLeader;
  readOnly: true;
};

export type AdminHouseholdLedgerListParams = {
  teamLeaderId: string;
  datePreset?: 'today' | 'all' | 'month' | 'day';
  month?: string;
  day?: string;
  limit?: number;
  offset?: number;
};

async function parseJsonError(res: Response, fallback: string): Promise<never> {
  if (res.status === 401) throw new AuthSessionExpiredError();
  let msg = fallback;
  try {
    const body = (await res.json()) as { error?: string };
    if (body.error) msg = body.error;
  } catch {
    /* ignore */
  }
  throw new Error(msg);
}

export async function getAdminHouseholdLedgerTeamLeaders(
  token: string,
): Promise<{ items: AdminHouseholdLedgerTeamLeader[] }> {
  const res = await fetch(`${API}/admin/household-ledger/team-leaders`, { headers: headers(token) });
  if (!res.ok) return parseJsonError(res, '팀장 목록을 불러올 수 없습니다.');
  return res.json() as Promise<{ items: AdminHouseholdLedgerTeamLeader[] }>;
}

export async function getAdminHouseholdLedgerEntries(
  token: string,
  params: AdminHouseholdLedgerListParams,
): Promise<AdminHouseholdLedgerListResponse> {
  const qs = new URLSearchParams();
  qs.set('teamLeaderId', params.teamLeaderId);
  if (params.datePreset) qs.set('datePreset', params.datePreset);
  if (params.month) qs.set('month', params.month);
  if (params.day) qs.set('day', params.day);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  const res = await fetch(`${API}/admin/household-ledger/entries?${qs.toString()}`, {
    headers: headers(token),
  });
  if (!res.ok) return parseJsonError(res, '가계부를 불러올 수 없습니다.');
  return res.json() as Promise<AdminHouseholdLedgerListResponse>;
}
