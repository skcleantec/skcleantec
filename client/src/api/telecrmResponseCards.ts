import { appendCrmWorkBrandQuery } from '../utils/crmWorkBrandQuery';

const API = '/api/crm/response-cards';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    throw new Error('서버 응답을 해석할 수 없습니다.');
  }
  const err = data as { error?: string } | null;
  if (!res.ok) throw new Error(typeof err?.error === 'string' ? err.error : '요청 실패');
  return data as T;
}

export type TelecrmResponseCardStatus = 'draft' | 'approved' | 'archived';

export type TelecrmResponseCardDto = {
  id: string;
  code: string;
  category: string;
  title: string;
  triggers: string[];
  intent: string;
  responses: [string, string][];
  avoid: string[];
  rule: string;
  sources: string[];
  wonInCall: boolean;
  operatingCompanyId: string | null;
  status?: TelecrmResponseCardStatus | string;
  useCount?: number;
  /** 이 카드를 요청한 상담사가 복사한 횟수 */
  myCopyCount?: number;
  upCount?: number;
  downCount?: number;
  approvedAt?: string | null;
  updatedAt?: string;
  score?: number;
};

export type TelecrmResponseQuoteItem = { label: string; manWon: number };

export type TelecrmResponseCardCustomer = {
  pyeong?: string;
  structure?: string;
  cleaningType?: string;
  brand?: string;
  step?: string;
  quoteTotalManWon?: number;
  quoteItems?: TelecrmResponseQuoteItem[];
};

export type TelecrmResponseCoachResult = {
  suggestions: { label: string; text: string }[];
  nextQuestion: string;
  basedOn: string[];
};

export type TelecrmResponseCardImportItem = {
  id?: string;
  code?: string;
  cat?: string;
  category?: string;
  title: string;
  say?: string[];
  triggers?: string[];
  mind?: string;
  intent?: string;
  res?: [string, string][];
  responses?: [string, string][];
  avoid?: string[];
  rule?: string;
  src?: string[];
  sources?: string[];
  win?: boolean;
  wonInCall?: boolean;
};

export async function searchTelecrmResponseCards(
  token: string,
  q: string,
  operatingCompanyId?: string | null,
): Promise<{ items: TelecrmResponseCardDto[] }> {
  const qs = new URLSearchParams();
  qs.set('q', q);
  appendCrmWorkBrandQuery(qs, operatingCompanyId);
  const res = await fetch(`${API}/search?${qs}`, { headers: authHeaders(token) });
  return parseJson(res);
}

export async function importTelecrmResponseCards(
  token: string,
  cards: TelecrmResponseCardImportItem[],
  operatingCompanyId?: string | null,
): Promise<{ created: number; updated: number; embedded: number }> {
  const res = await fetch(`${API}/import`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ cards, operatingCompanyId: operatingCompanyId ?? undefined }),
  });
  return parseJson(res);
}

export async function coachTelecrmResponseCards(
  token: string,
  body: { q: string; cardIds: string[]; customer?: TelecrmResponseCardCustomer },
  operatingCompanyId?: string | null,
): Promise<TelecrmResponseCoachResult> {
  const res = await fetch(`${API}/coach`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ ...body, operatingCompanyId: operatingCompanyId ?? undefined }),
  });
  return parseJson(res);
}

/** stream:true. delta 글자가 온 뒤 done에 최종 JSON이 온다. */
export async function coachTelecrmResponseCardsStream(
  token: string,
  body: { q: string; cardIds: string[]; customer?: TelecrmResponseCardCustomer },
  handlers: {
    onDelta?: (text: string) => void;
    operatingCompanyId?: string | null;
  },
): Promise<TelecrmResponseCoachResult> {
  const res = await fetch(`${API}/coach`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      ...body,
      stream: true,
      operatingCompanyId: handlers.operatingCompanyId ?? undefined,
    }),
  });
  if (!res.ok || !res.body) {
    return parseJson(res);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let donePayload: TelecrmResponseCoachResult | null = null;
  for (;;) {
    const chunk = await reader.read();
    if (chunk.done) break;
    buffer += decoder.decode(chunk.value, { stream: true });
    const parts = buffer.split('\n\n');
    buffer = parts.pop() ?? '';
    for (const part of parts) {
      const event = part.match(/^event:\s*(\S+)/m)?.[1];
      const dataLine = part
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(5).trim())
        .join('');
      if (!dataLine) continue;
      const data = JSON.parse(dataLine) as { text?: string; error?: string };
      if (event === 'delta' && data.text) handlers.onDelta?.(data.text);
      if (event === 'error') throw new Error(data.error || 'AI 코치에 실패했습니다.');
      if (event === 'done') donePayload = data as TelecrmResponseCoachResult;
    }
  }
  if (!donePayload) throw new Error('AI 코치 응답이 없습니다.');
  return donePayload;
}

export async function feedbackTelecrmResponseCard(
  token: string,
  id: string,
  body: { action: 'copy' | 'up' | 'down'; inquiryId?: string },
): Promise<{ ok: true; useCount: number; upCount: number; downCount: number }> {
  const res = await fetch(`${API}/${encodeURIComponent(id)}/feedback`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJson(res);
}

export async function listTelecrmResponseCards(
  token: string,
  status: TelecrmResponseCardStatus = 'draft',
  operatingCompanyId?: string | null,
): Promise<{ items: TelecrmResponseCardDto[] }> {
  const qs = new URLSearchParams();
  qs.set('status', status);
  appendCrmWorkBrandQuery(qs, operatingCompanyId);
  const res = await fetch(`${API}?${qs}`, { headers: authHeaders(token) });
  return parseJson(res);
}

/**
 * 상담사가 훑어보는 「사용 중」 카드 전체.
 * 서버에 훑어보기 주소가 아직 없으면(404) 관리자 목록으로 대신한다.
 */
export async function browseTelecrmResponseCards(
  token: string,
  operatingCompanyId?: string | null,
): Promise<{ items: TelecrmResponseCardDto[] }> {
  const qs = new URLSearchParams();
  appendCrmWorkBrandQuery(qs, operatingCompanyId);
  const res = await fetch(`${API}/browse?${qs}`, { headers: authHeaders(token) });
  if (res.status === 404) return listTelecrmResponseCards(token, 'approved', operatingCompanyId);
  return parseJson(res);
}

export async function patchTelecrmResponseCard(
  token: string,
  id: string,
  patch: Partial<
    Pick<
      TelecrmResponseCardDto,
      'category' | 'title' | 'triggers' | 'intent' | 'responses' | 'avoid' | 'rule' | 'sources' | 'wonInCall' | 'status'
    >
  > & { operatingCompanyId?: string | null },
): Promise<{ ok: true }> {
  const res = await fetch(`${API}/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
  return parseJson(res);
}

export async function fetchTelecrmResponseSearchGaps(
  token: string,
): Promise<{ items: { q: string; count: number }[] }> {
  const res = await fetch(`${API}/search-gaps`, { headers: authHeaders(token) });
  return parseJson(res);
}
