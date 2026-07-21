import type { TelecrmConsultationQuoteDto } from './telecrmConsultationQuote';
import { appendCrmWorkBrandQuery } from '../utils/crmWorkBrandQuery';

const API = '/api/crm';

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error((data as { error?: string }).error ?? '요청에 실패했습니다.');
  return data as T;
}

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export type TelecrmCatalogScope = 'work' | 'shared' | 'personal';
export type TelecrmCatalogOwnerScope = 'shared' | 'personal';

export type TelecrmScriptTabDto = {
  id: string;
  categoryId: string;
  label: string;
  body: string;
  sortOrder: number;
  isActive: boolean;
};

export type TelecrmScriptCategoryDto = {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  ownerUserId?: string | null;
  ownerScope?: TelecrmCatalogOwnerScope;
  tabs?: TelecrmScriptTabDto[];
};

export type TelecrmPriceItemDto = {
  id: string;
  categoryId: string;
  name: string;
  amountWon: number;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type TelecrmPriceCategoryDto = {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
  ownerUserId?: string | null;
  ownerScope?: TelecrmCatalogOwnerScope;
  items?: TelecrmPriceItemDto[];
};

export type TelecrmPricingCatalogDto = {
  categories: TelecrmPriceCategoryDto[];
  estimateConfig: { pricePerPyeong: number; depositAmount: number; minimumTotalAmount: number };
};

export type TelecrmCustomerCandidateDto = {
  key: string;
  customerName: string;
  nickname: string | null;
  customerPhone: string;
  lastAddress: string | null;
  inquiryCount: number;
  latestAt: string;
};

export type TelecrmInquiryBriefDto = {
  id: string;
  status: string;
  createdAt: string;
  customerName: string;
  nickname: string | null;
  customerPhone: string;
  memo: string | null;
  specialNotes: string | null;
  claimMemo: string | null;
  address: string;
  areaPyeong: number | null;
  preferredDate: string | null;
  preferredTime: string | null;
  orderFormTemplate: {
    id: string;
    title: string;
    icon: string | null;
    fields: { fieldKey: string; label: string }[];
  } | null;
  orderForm: {
    submittedAt: string | null;
    totalAmount: number;
    depositAmount: number;
    balanceAmount: number;
    customerSpecialNotes: string | null;
    optionNote: string | null;
    customAnswers: { key: string; label: string; value: string }[];
  } | null;
};

export type TelecrmCustomerLookupDto = {
  match: 'existing' | 'new' | 'pick';
  searchBy: 'phone' | 'name';
  candidates: TelecrmCustomerCandidateDto[];
  customer: {
    name: string | null;
    nickname: string | null;
    phone: string;
    lastAddress: string | null;
  };
  inquiries: TelecrmInquiryBriefDto[];
  followups: {
    id: string;
    status: string;
    createdAt: string;
    customerName: string;
    nickname: string | null;
    customerPhone: string;
    memo: string | null;
    inquiryId: string | null;
  }[];
  csReports: {
    id: string;
    status: string;
    createdAt: string;
    customerName: string;
    customerPhone: string;
    content: string;
    memo: string | null;
    inquiryId: string | null;
  }[];
  latestQuote: TelecrmConsultationQuoteDto | null;
};

export async function fetchTelecrmCustomerLookup(
  token: string,
  params: { phone?: string; name?: string },
  operatingCompanyId?: string | null,
): Promise<TelecrmCustomerLookupDto> {
  const qs = new URLSearchParams();
  if (params.phone?.trim()) qs.set('phone', params.phone.trim());
  if (params.name?.trim()) qs.set('name', params.name.trim());
  appendCrmWorkBrandQuery(qs, operatingCompanyId);
  const q = qs.toString() ? `?${qs}` : '';
  const res = await fetch(`${API}/customer-lookup${q}`, { headers: authHeaders(token) });
  return parseJson(res);
}

export async function fetchTelecrmScripts(
  token: string,
  opts?: { includeInactive?: boolean; scope?: TelecrmCatalogScope },
): Promise<{ categories: TelecrmScriptCategoryDto[] }> {
  const params = new URLSearchParams();
  if (opts?.includeInactive) params.set('includeInactive', '1');
  if (opts?.scope) params.set('scope', opts.scope);
  const q = params.toString() ? `?${params}` : '';
  const res = await fetch(`${API}/script-categories${q}`, { headers: authHeaders(token) });
  return parseJson(res);
}

export async function createTelecrmScriptCategory(
  token: string,
  body: { label: string; ownerScope?: TelecrmCatalogOwnerScope },
): Promise<TelecrmScriptCategoryDto> {
  const res = await fetch(`${API}/script-categories`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function updateTelecrmScriptCategory(
  token: string,
  id: string,
  body: Partial<{ label: string; sortOrder: number; isActive: boolean }>,
): Promise<TelecrmScriptCategoryDto> {
  const res = await fetch(`${API}/script-categories/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function deleteTelecrmScriptCategory(
  token: string,
  id: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${API}/script-categories/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ password }),
  });
  await parseJson(res);
}

export async function reorderTelecrmScriptCategories(
  token: string,
  orderedIds: string[],
): Promise<void> {
  const res = await fetch(`${API}/script-categories/reorder`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ orderedIds }),
  });
  await parseJson(res);
}

export async function createTelecrmScriptTab(
  token: string,
  body: { categoryId: string; label: string; body?: string },
): Promise<TelecrmScriptTabDto> {
  const res = await fetch(`${API}/script-tabs`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function updateTelecrmScriptTab(
  token: string,
  id: string,
  body: Partial<{ label: string; body: string; sortOrder: number; isActive: boolean }>,
): Promise<TelecrmScriptTabDto> {
  const res = await fetch(`${API}/script-tabs/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function deleteTelecrmScriptTab(
  token: string,
  id: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${API}/script-tabs/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ password }),
  });
  await parseJson(res);
}

export async function reorderTelecrmScriptTabs(
  token: string,
  categoryId: string,
  orderedIds: string[],
): Promise<void> {
  const res = await fetch(`${API}/script-tabs/reorder`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ categoryId, orderedIds }),
  });
  await parseJson(res);
}

export async function fetchTelecrmPriceCategories(
  token: string,
  opts?: { includeInactive?: boolean; scope?: TelecrmCatalogScope },
): Promise<{ categories: TelecrmPriceCategoryDto[] }> {
  const params = new URLSearchParams();
  if (opts?.includeInactive) params.set('includeInactive', '1');
  if (opts?.scope) params.set('scope', opts.scope);
  const q = params.toString() ? `?${params}` : '';
  const res = await fetch(`${API}/price-categories${q}`, { headers: authHeaders(token) });
  return parseJson(res);
}

export async function createTelecrmPriceCategory(
  token: string,
  body: { label: string; ownerScope?: TelecrmCatalogOwnerScope },
): Promise<TelecrmPriceCategoryDto> {
  const res = await fetch(`${API}/price-categories`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function updateTelecrmPriceCategory(
  token: string,
  id: string,
  body: Partial<{ label: string; sortOrder: number; isActive: boolean }>,
): Promise<TelecrmPriceCategoryDto> {
  const res = await fetch(`${API}/price-categories/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function deleteTelecrmPriceCategory(
  token: string,
  id: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${API}/price-categories/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ password }),
  });
  await parseJson(res);
}

export async function reorderTelecrmPriceCategories(
  token: string,
  orderedIds: string[],
): Promise<void> {
  const res = await fetch(`${API}/price-categories/reorder`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ orderedIds }),
  });
  await parseJson(res);
}

export async function createTelecrmPriceItem(
  token: string,
  body: { categoryId: string; name: string; amountWon: number; description?: string },
): Promise<TelecrmPriceItemDto> {
  const res = await fetch(`${API}/price-items`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function updateTelecrmPriceItem(
  token: string,
  id: string,
  body: Partial<{
    name: string;
    amountWon: number;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
  }>,
): Promise<TelecrmPriceItemDto> {
  const res = await fetch(`${API}/price-items/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function deleteTelecrmPriceItem(
  token: string,
  id: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${API}/price-items/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ password }),
  });
  await parseJson(res);
}

export async function reorderTelecrmPriceItems(
  token: string,
  categoryId: string,
  orderedIds: string[],
): Promise<void> {
  const res = await fetch(`${API}/price-items/reorder`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ categoryId, orderedIds }),
  });
  await parseJson(res);
}

export async function fetchTelecrmPricingCatalog(
  token: string,
  q?: string,
): Promise<TelecrmPricingCatalogDto> {
  const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  const res = await fetch(`${API}/pricing/catalog${qs}`, { headers: authHeaders(token) });
  return parseJson(res);
}

export type TelecrmOrderOptionDto = {
  id: string;
  label: string;
  labelPath: string;
  priceAmount: number | null;
  priceHint: string | null;
  emoji: string | null;
};

export async function fetchTelecrmOrderOptions(
  token: string,
  q?: string,
): Promise<{ items: TelecrmOrderOptionDto[] }> {
  const qs = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : '';
  const res = await fetch(`${API}/order-options${qs}`, { headers: authHeaders(token) });
  return parseJson(res);
}

export type TelecrmWorkdeskStatsDto = {
  day: string;
  callCount: number;
  totalDurationSec: number;
  connectedCount: number;
  noAnswerCount: number;
  dialAttemptCount: number;
  connectedDurationSec: number;
  lastConnectedAt: string | null;
  receivedCount: number;
  absentHoldCount: number;
};

export type TelecrmCallSessionSummaryDto = {
  day: string;
  connectedMinSec: number;
  connectedCount: number;
  noAnswerCount: number;
  dialAttemptCount: number;
  callCount: number;
  connectedDurationSec: number;
  totalDurationSec: number;
  byCustomerMatch: Record<string, number>;
  lastConnectedAt: string | null;
};

export type TelecrmCallSessionTeamRowDto = {
  userId: string;
  userName: string | null;
  loginId: string | null;
  connectedCount: number;
  noAnswerCount: number;
  dialAttemptCount: number;
  connectedDurationSec: number;
  avgConnectedDurationSec: number;
  lastConnectedAt: string | null;
  avgGapMin: number | null;
};

export type TelecrmCallSessionListItemDto = {
  id: string;
  phone: string;
  direction: string;
  status: string;
  durationSec: number | null;
  startedAt: string | null;
  endedAt: string | null;
  customerMatch: string | null;
  inquiryId: string | null;
  source: string | null;
  createdAt: string;
  user?: { id: string; name: string | null; email: string | null };
};

export async function fetchTelecrmWorkdeskStats(
  token: string,
  day?: string,
): Promise<TelecrmWorkdeskStatsDto> {
  const qs = day ? `?day=${encodeURIComponent(day)}` : '';
  const res = await fetch(`${API}/workdesk-stats${qs}`, { headers: authHeaders(token) });
  return parseJson(res);
}

export async function fetchTelecrmCallSessionTeamSummary(
  token: string,
  from: string,
  to: string,
): Promise<{ from: string; to: string; connectedMinSec: number; items: TelecrmCallSessionTeamRowDto[] }> {
  const qs = new URLSearchParams({ from, to });
  const res = await fetch(`${API}/call-sessions/team-summary?${qs}`, { headers: authHeaders(token) });
  return parseJson(res);
}

export async function fetchTelecrmCallSessions(
  token: string,
  params: {
    from: string;
    to: string;
    userId?: string;
    status?: 'CONNECTED' | 'NO_ANSWER' | 'DIAL_ATTEMPT';
    limit?: number;
    offset?: number;
  },
): Promise<{ items: TelecrmCallSessionListItemDto[]; total: number }> {
  const qs = new URLSearchParams({ from: params.from, to: params.to });
  if (params.userId) qs.set('userId', params.userId);
  if (params.status) qs.set('status', params.status);
  if (params.limit != null) qs.set('limit', String(params.limit));
  if (params.offset != null) qs.set('offset', String(params.offset));
  const res = await fetch(`${API}/call-sessions?${qs}`, { headers: authHeaders(token) });
  return parseJson(res);
}

export type TelecrmContactTimelineItemDto = {
  id: string;
  kind: string;
  at: string;
  actorName: string | null;
  actorId: string | null;
  title: string;
  detail: string | null;
  active: boolean;
};

export async function fetchTelecrmContactTimeline(
  token: string,
  opts: {
    customerName?: string;
    nickname?: string;
    region?: string;
    address?: string;
    phone?: string;
    phone2?: string | null;
    operatingCompanyId?: string | null;
    limit?: number;
  },
): Promise<{ items: TelecrmContactTimelineItemDto[] }> {
  const qs = new URLSearchParams();
  if (opts.customerName?.trim()) qs.set('customerName', opts.customerName.trim());
  if (opts.nickname?.trim()) qs.set('nickname', opts.nickname.trim());
  if (opts.region?.trim()) qs.set('region', opts.region.trim());
  if (opts.address?.trim()) qs.set('address', opts.address.trim());
  if (opts.phone?.replace(/\D/g, '').length) qs.set('phone', opts.phone.replace(/\D/g, ''));
  if (opts.phone2?.replace(/\D/g, '').length) qs.set('phone2', opts.phone2.replace(/\D/g, ''));
  if (opts.operatingCompanyId) qs.set('operatingCompanyId', opts.operatingCompanyId);
  if (opts.limit != null) qs.set('limit', String(opts.limit));
  const res = await fetch(`${API}/contact-timeline?${qs}`, { headers: authHeaders(token) });
  return parseJson(res);
}
