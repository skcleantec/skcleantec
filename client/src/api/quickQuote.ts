import type { SoomgoMessageStep } from '@shared/soomgoMessagePresets';

export type QuickQuoteKind = {
  id: string;
  source: 'auto_quote' | 'quick_quote';
  label: string;
  steps: SoomgoMessageStep[];
  paybackWon: number | null;
  isActive: boolean;
  sortOrder: number;
};

const API = '/api/crm/quick-quote';

export class QuickQuoteForbiddenError extends Error {
  constructor() {
    super('CRM 사용이 켜진 계정만 쓸 수 있어요');
    this.name = 'QuickQuoteForbiddenError';
  }
}

function headers(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function readKinds(res: Response, forbiddenOn403: boolean): Promise<{ kinds: QuickQuoteKind[] }> {
  const data = (await res.json().catch(() => ({}))) as { kinds?: QuickQuoteKind[]; error?: string };
  if (res.status === 403) {
    if (forbiddenOn403) throw new QuickQuoteForbiddenError();
    throw new Error('문구를 바꿀 권한이 없어요.');
  }
  if (!res.ok) throw new Error(data.error || '견적 문구를 불러오지 못했어요.');
  return { kinds: data.kinds ?? [] };
}

export async function fetchQuickQuoteKinds(token: string, operatingCompanyId: string) {
  const q = new URLSearchParams({ operatingCompanyId });
  const res = await fetch(`${API}/kinds?${q}`, { headers: headers(token) });
  return readKinds(res, true);
}

export async function saveQuickQuoteAutoKind(
  token: string,
  input: { operatingCompanyId: string; steps: SoomgoMessageStep[]; paybackWon: number | null },
) {
  const res = await fetch(`${API}/kinds/auto_quote`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(input),
  });
  return readKinds(res, false);
}

export async function createQuickQuoteKind(
  token: string,
  input: { operatingCompanyId: string; label: string; steps: SoomgoMessageStep[]; paybackWon: number | null },
) {
  const res = await fetch(`${API}/kinds`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(input),
  });
  return readKinds(res, false);
}

export async function updateQuickQuoteKind(
  token: string,
  id: string,
  input: { operatingCompanyId: string; label: string; steps: SoomgoMessageStep[]; paybackWon: number | null },
) {
  const res = await fetch(`${API}/kinds/${encodeURIComponent(id)}`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(input),
  });
  return readKinds(res, false);
}

export async function deleteQuickQuoteKind(
  token: string,
  id: string,
  input: { operatingCompanyId: string; password: string },
) {
  const res = await fetch(`${API}/kinds/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(token),
    body: JSON.stringify(input),
  });
  return readKinds(res, false);
}

export async function reorderQuickQuoteKinds(
  token: string,
  input: { operatingCompanyId: string; orderedIds: string[] },
) {
  const res = await fetch(`${API}/kinds/reorder`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(input),
  });
  return readKinds(res, false);
}
