import type { TeamLeaderHouseholdLedgerDirection, TeamLeaderHouseholdPrefillKind } from '@shared/teamLeaderHouseholdLedger';
import { API } from './apiPrefix';
import { AuthSessionExpiredError } from './auth';
import { withTeamPreviewQuery } from '../utils/teamPreviewQuery';

function headers(token: string) {
  return {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };
}

export type HouseholdLedgerEntry = {
  id: string;
  direction: TeamLeaderHouseholdLedgerDirection;
  occurredOn: string;
  category: string;
  amount: number;
  memo: string | null;
  inquiryId: string | null;
  inquiryNumber: string | null;
  customerName: string | null;
  prefillKind: string | null;
  createdAt: string;
  updatedAt: string;
};

export type HouseholdLedgerListResponse = {
  range: { loYmd: string; hiYmd: string };
  summary: { incomeTotal: number; expenseTotal: number; netTotal: number };
  items: HouseholdLedgerEntry[];
  total: number;
  limit: number;
  offset: number;
};

export type HouseholdLedgerCategoriesResponse = {
  income: string[];
  expense: string[];
};

export type HouseholdLedgerPrefillOption = {
  kind: TeamLeaderHouseholdPrefillKind;
  direction: TeamLeaderHouseholdLedgerDirection;
  category: string;
  amount: number;
  label: string;
  memoHint: string | null;
};

export type HouseholdLedgerPrefillResponse = {
  inquiryId: string;
  inquiryNumber: string | null;
  customerName: string;
  items: HouseholdLedgerPrefillOption[];
};

export type HouseholdLedgerListParams = {
  datePreset?: 'today' | 'all' | 'month' | 'day';
  month?: string;
  day?: string;
  limit?: number;
  offset?: number;
};

export type HouseholdLedgerEntryPayload = {
  direction: TeamLeaderHouseholdLedgerDirection;
  category: string;
  amount: number;
  occurredOn?: string;
  memo?: string | null;
  inquiryId?: string | null;
  prefillKind?: string | null;
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

export async function getTeamHouseholdLedgerCategories(token: string): Promise<HouseholdLedgerCategoriesResponse> {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/household-ledger/categories`), {
    headers: headers(token),
  });
  if (!res.ok) return parseJsonError(res, '카테고리를 불러올 수 없습니다.');
  return res.json() as Promise<HouseholdLedgerCategoriesResponse>;
}

export async function getTeamHouseholdLedgerEntries(
  token: string,
  params?: HouseholdLedgerListParams,
): Promise<HouseholdLedgerListResponse> {
  const qs = new URLSearchParams();
  if (params?.datePreset) qs.set('datePreset', params.datePreset);
  if (params?.month) qs.set('month', params.month);
  if (params?.day) qs.set('day', params.day);
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  const q = qs.toString();
  const res = await fetch(withTeamPreviewQuery(`${API}/team/household-ledger/entries${q ? `?${q}` : ''}`), {
    headers: headers(token),
  });
  if (!res.ok) return parseJsonError(res, '가계부 목록을 불러올 수 없습니다.');
  return res.json() as Promise<HouseholdLedgerListResponse>;
}

export async function getTeamHouseholdLedgerPrefill(
  token: string,
  inquiryId: string,
): Promise<HouseholdLedgerPrefillResponse> {
  const res = await fetch(
    withTeamPreviewQuery(`${API}/team/household-ledger/prefill/${encodeURIComponent(inquiryId)}`),
    { headers: headers(token) },
  );
  if (!res.ok) return parseJsonError(res, '접수 금액 정보를 불러올 수 없습니다.');
  return res.json() as Promise<HouseholdLedgerPrefillResponse>;
}

export async function createTeamHouseholdLedgerEntry(
  token: string,
  payload: HouseholdLedgerEntryPayload,
): Promise<{ item: HouseholdLedgerEntry }> {
  const res = await fetch(withTeamPreviewQuery(`${API}/team/household-ledger/entries`), {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(payload),
  });
  if (!res.ok) return parseJsonError(res, '저장에 실패했습니다.');
  return res.json() as Promise<{ item: HouseholdLedgerEntry }>;
}

export async function updateTeamHouseholdLedgerEntry(
  token: string,
  entryId: string,
  payload: Partial<HouseholdLedgerEntryPayload>,
): Promise<{ item: HouseholdLedgerEntry }> {
  const res = await fetch(
    withTeamPreviewQuery(`${API}/team/household-ledger/entries/${encodeURIComponent(entryId)}`),
    {
      method: 'PATCH',
      headers: headers(token),
      body: JSON.stringify(payload),
    },
  );
  if (!res.ok) return parseJsonError(res, '수정에 실패했습니다.');
  return res.json() as Promise<{ item: HouseholdLedgerEntry }>;
}

export async function deleteTeamHouseholdLedgerEntry(token: string, entryId: string): Promise<void> {
  const res = await fetch(
    withTeamPreviewQuery(`${API}/team/household-ledger/entries/${encodeURIComponent(entryId)}`),
    {
      method: 'DELETE',
      headers: headers(token),
    },
  );
  if (!res.ok) return parseJsonError(res, '삭제에 실패했습니다.');
}
