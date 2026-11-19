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

export type QuickQuoteAddressHit = {
  road: string;
  jibun: string;
  building: string;
  apartment?: boolean;
  relJibun?: string;
  admCd: string;
  rnMgtSn: string;
  udrtYn: string;
  buldMnnm: string;
  buldSlno: string;
  lnbrMnnm: string;
  lnbrSlno: string;
  mtYn: string;
};

export type QuickQuoteAddressPage = {
  items: QuickQuoteAddressHit[];
  total: number;
  page: number;
  notice: string | null;
};

export type QuickQuoteUnit = { floor: string; ho: string };

export type QuickQuoteAreaGroup = {
  exclusiveSqm: number;
  supplySqm: number | null;
  supplyPyeong: number | null;
  households: number;
  supplyUnconfirmed?: boolean;
};

export type QuickQuoteAreasResult =
  | { kind: 'groups'; groups: QuickQuoteAreaGroup[] }
  | {
      kind: 'unit';
      exclusiveSqm: number;
      supplySqm: number | null;
      supplyPyeong: number | null;
      supplyUnconfirmed?: boolean;
    }
  | { kind: 'building'; totalSqm: number; note: string }
  | { kind: 'empty'; note?: string };

async function readLookup<T>(res: Response): Promise<T> {
  const data = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) throw new Error(data.error || '주소를 찾지 못했어요.');
  return data as T;
}

export async function searchQuickQuoteAddress(token: string, q: string, page = 1) {
  const params = new URLSearchParams({ q, page: String(page) });
  const res = await fetch(`${API}/address?${params}`, { headers: headers(token) });
  return readLookup<QuickQuoteAddressPage>(res);
}

export async function fetchQuickQuoteUnits(
  token: string,
  address: Pick<QuickQuoteAddressHit, 'admCd' | 'rnMgtSn' | 'udrtYn' | 'buldMnnm' | 'buldSlno'>,
  dongNm?: string,
) {
  const params = new URLSearchParams({
    admCd: address.admCd,
    rnMgtSn: address.rnMgtSn,
    udrtYn: address.udrtYn,
    buldMnnm: address.buldMnnm,
    buldSlno: address.buldSlno,
  });
  if (dongNm) params.set('dongNm', dongNm);
  const res = await fetch(`${API}/units?${params}`, { headers: headers(token) });
  return readLookup<{ dongs: string[]; units: QuickQuoteUnit[] }>(res);
}

export async function fetchQuickQuoteAreas(
  token: string,
  address: QuickQuoteAddressHit,
  dongNm?: string,
  hoNm?: string,
  keyword?: string,
) {
  const params = new URLSearchParams({
    admCd: address.admCd,
    rnMgtSn: address.rnMgtSn,
    udrtYn: address.udrtYn,
    buldMnnm: address.buldMnnm,
    buldSlno: address.buldSlno,
    lnbrMnnm: address.lnbrMnnm,
    lnbrSlno: address.lnbrSlno,
    mtYn: address.mtYn,
  });
  if (dongNm) params.set('dongNm', dongNm);
  if (hoNm) params.set('hoNm', hoNm);
  if (address.relJibun) params.set('relJibun', address.relJibun.slice(0, 500));
  if (keyword) params.set('q', keyword);
  const res = await fetch(`${API}/areas?${params}`, { headers: headers(token) });
  return readLookup<QuickQuoteAreasResult>(res);
}
