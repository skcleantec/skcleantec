import type {
  TelecrmAiQuote,
  TelecrmAiQuoteChatMessage,
  TelecrmAiQuoteChatReply,
  TelecrmAiQuoteModelStatus,
  TelecrmAiQuoteRuleDto,
  TelecrmAiQuoteRuleExample,
  TelecrmAiQuoteRuleParseResult,
  TelecrmAiQuoteRuleSpec,
} from '@shared/telecrmQuoteCrewLearning';

import type {
  TelecrmQuoteCrewLearningBackfillResult,
  TelecrmQuoteCrewLearningHints,
  TelecrmQuoteCrewLearningOverview,
  TelecrmPropertyChoiceOptions,
} from '@shared/telecrmQuoteCrewLearning';

const API = '/api/crm';

async function parseJson<T>(res: Response): Promise<T> {
  const data = (await res.json()) as T & { error?: string };
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export async function fetchTelecrmQuoteCrewLearningOverview(
  token: string,
): Promise<TelecrmQuoteCrewLearningOverview> {
  const res = await fetch(`${API}/quote-learning/overview`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson<TelecrmQuoteCrewLearningOverview>(res);
}

export async function fetchTelecrmQuoteCrewLearningHints(
  token: string,
  query: {
    pyeong?: string;
    propertyType?: string;
    buildingType?: string;
    isOneRoom?: boolean;
    roomCount?: string;
    bathroomCount?: string;
    balconyCount?: string;
    operatingCompanyId?: string;
  },
): Promise<TelecrmQuoteCrewLearningHints> {
  const params = new URLSearchParams();
  if (query.pyeong?.trim()) params.set('pyeong', query.pyeong.trim());
  if (query.propertyType?.trim()) params.set('propertyType', query.propertyType.trim());
  if (query.buildingType?.trim()) params.set('buildingType', query.buildingType.trim());
  if (query.isOneRoom) params.set('isOneRoom', 'true');
  if (query.roomCount?.trim()) params.set('roomCount', query.roomCount.trim());
  if (query.bathroomCount?.trim()) params.set('bathroomCount', query.bathroomCount.trim());
  if (query.balconyCount?.trim()) params.set('balconyCount', query.balconyCount.trim());
  if (query.operatingCompanyId?.trim()) params.set('operatingCompanyId', query.operatingCompanyId.trim());
  const qs = params.toString();
  const res = await fetch(`${API}/quote-learning/hints${qs ? `?${qs}` : ''}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson<TelecrmQuoteCrewLearningHints>(res);
}

export type TelecrmQuoteCrewLearningBackfillResponse = TelecrmQuoteCrewLearningBackfillResult & {
  overview: TelecrmQuoteCrewLearningOverview;
};

export async function backfillTelecrmQuoteCrewLearning(
  token: string,
  /** 비우면 전체 접수를 학습 (서버가 500건씩 나눠 처리) */
  limit?: number,
): Promise<TelecrmQuoteCrewLearningBackfillResponse> {
  const res = await fetch(`${API}/quote-learning/backfill`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(limit != null ? { limit } : {}),
  });
  return parseJson<TelecrmQuoteCrewLearningBackfillResponse>(res);
}

/** 접수란 건축물 유형·건물 형태 선택지 — 손님 발주서와 같은 목록 */
export async function fetchTelecrmPropertyChoiceOptions(token: string): Promise<TelecrmPropertyChoiceOptions> {
  const res = await fetch(`${API}/quote-learning/property-options`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson<TelecrmPropertyChoiceOptions>(res);
}

// ── AI 견적 — 말로 넣는 규칙 · 학습 상태 · 직접 물어보기 ──
function jsonHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

function brandQs(operatingCompanyId?: string | null): string {
  return operatingCompanyId ? `?operatingCompanyId=${encodeURIComponent(operatingCompanyId)}` : '';
}

export async function fetchTelecrmAiQuoteStatus(token: string, operatingCompanyId?: string | null) {
  const res = await fetch(`${API}/quote-learning/ai-quote/status${brandQs(operatingCompanyId)}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson<TelecrmAiQuoteModelStatus>(res);
}

export async function fetchTelecrmAiQuoteRules(token: string) {
  const res = await fetch(`${API}/quote-learning/ai-quote/rules`, { headers: { Authorization: `Bearer ${token}` } });
  return parseJson<{ items: TelecrmAiQuoteRuleDto[] }>(res);
}

export async function parseTelecrmAiQuoteRule(token: string, text: string, operatingCompanyId?: string | null) {
  const res = await fetch(`${API}/quote-learning/ai-quote/rules/parse`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ text, operatingCompanyId: operatingCompanyId ?? undefined }),
  });
  return parseJson<TelecrmAiQuoteRuleParseResult>(res);
}

export async function saveTelecrmAiQuoteRule(
  token: string,
  input: { text: string; spec: TelecrmAiQuoteRuleSpec; operatingCompanyId?: string | null },
) {
  const res = await fetch(`${API}/quote-learning/ai-quote/rules`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ ...input, operatingCompanyId: input.operatingCompanyId ?? undefined }),
  });
  return parseJson<{ rule: TelecrmAiQuoteRuleDto; examples: TelecrmAiQuoteRuleExample[]; status: TelecrmAiQuoteModelStatus }>(res);
}

export async function updateTelecrmAiQuoteRule(token: string, id: string, patch: { isActive?: boolean }) {
  const res = await fetch(`${API}/quote-learning/ai-quote/rules/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: jsonHeaders(token),
    body: JSON.stringify(patch),
  });
  return parseJson<{ rule: TelecrmAiQuoteRuleDto; status: TelecrmAiQuoteModelStatus }>(res);
}

export async function deleteTelecrmAiQuoteRule(token: string, id: string) {
  const res = await fetch(`${API}/quote-learning/ai-quote/rules/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
  });
  return parseJson<{ ok: true; status: TelecrmAiQuoteModelStatus }>(res);
}

export async function previewTelecrmAiQuote(
  token: string,
  input: {
    pyeong: number;
    roomCount?: number | null;
    bathroomCount?: number | null;
    balconyCount?: number | null;
    isOneRoom?: boolean;
    propertyType?: string | null;
    operatingCompanyId?: string | null;
  },
) {
  const res = await fetch(`${API}/quote-learning/ai-quote/preview`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify(input),
  });
  return parseJson<{ quote: TelecrmAiQuote | null }>(res);
}

export async function chatTelecrmAiQuoteRule(
  token: string,
  messages: TelecrmAiQuoteChatMessage[],
  operatingCompanyId?: string | null,
) {
  const res = await fetch(`${API}/quote-learning/ai-quote/rules/chat`, {
    method: 'POST',
    headers: jsonHeaders(token),
    body: JSON.stringify({ messages, operatingCompanyId: operatingCompanyId ?? undefined }),
  });
  return parseJson<TelecrmAiQuoteChatReply>(res);
}
