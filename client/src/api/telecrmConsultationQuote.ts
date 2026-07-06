import type {
  TelecrmConsultationQuotePayload,
  TelecrmConsultationQuoteStatus,
} from '@shared/telecrmConsultationQuote';

const API = '/api/crm/consultation-quotes';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function parseJson<T>(res: Response): Promise<T> {
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    if (text.trimStart().startsWith('<!DOCTYPE') || text.trimStart().startsWith('<html')) {
      throw new Error('API 경로 오류 또는 서버 미기동 — 페이지 HTML이 반환되었습니다.');
    }
    throw new Error('서버 응답을 해석할 수 없습니다.');
  }
  const err = data as { error?: string } | null;
  if (!res.ok) throw new Error(typeof err?.error === 'string' ? err.error : '요청 실패');
  return data as T;
}

export type TelecrmConsultationQuoteDto = {
  id: string;
  phone: string;
  status: TelecrmConsultationQuoteStatus;
  payload: TelecrmConsultationQuotePayload;
  followupId: string | null;
  inquiryId: string | null;
  createdById: string;
  updatedById: string;
  createdByName: string | null;
  updatedByName: string | null;
  createdAt: string;
  updatedAt: string;
};

export type TelecrmConsultationQuotesListDto = {
  draft: TelecrmConsultationQuoteDto | null;
  latestQuoted: TelecrmConsultationQuoteDto | null;
  active: TelecrmConsultationQuoteDto | null;
  history: TelecrmConsultationQuoteDto[];
};

export async function fetchTelecrmConsultationQuotes(
  token: string,
  phone: string,
): Promise<TelecrmConsultationQuotesListDto> {
  const qs = `?phone=${encodeURIComponent(phone.trim())}`;
  const res = await fetch(`${API}${qs}`, { headers: authHeaders(token) });
  return parseJson<TelecrmConsultationQuotesListDto>(res);
}

export async function upsertTelecrmConsultationQuoteDraft(
  token: string,
  body: { phone: string; payload: TelecrmConsultationQuotePayload },
): Promise<TelecrmConsultationQuoteDto> {
  const res = await fetch(`${API}/current`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJson<TelecrmConsultationQuoteDto>(res);
}

export async function supersedeTelecrmConsultationQuotes(
  token: string,
  phone: string,
): Promise<void> {
  const res = await fetch(`${API}/supersede-active`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ phone: phone.trim() }),
  });
  await parseJson<{ ok: true }>(res);
}

export type FinalizeTelecrmConsultationQuoteBody = {
  phone: string;
  payload: TelecrmConsultationQuotePayload;
  customerName: string;
  nickname?: string | null;
  goldDb?: boolean;
  preferredMoveInCleaningDate?: string | null;
  followupStatus: 'ABSENT' | 'ON_HOLD';
  extraMemo?: string | null;
  actorName?: string | null;
};

export type FinalizeTelecrmConsultationQuoteResult = {
  quote: TelecrmConsultationQuoteDto;
  followupId: string;
  followupCreated: boolean;
};

export async function finalizeTelecrmConsultationQuote(
  token: string,
  body: FinalizeTelecrmConsultationQuoteBody,
): Promise<FinalizeTelecrmConsultationQuoteResult> {
  const res = await fetch(`${API}/finalize`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  return parseJson<FinalizeTelecrmConsultationQuoteResult>(res);
}

export async function linkTelecrmConsultationQuoteInquiry(
  token: string,
  body: { phone: string; inquiryId?: string; orderFormId?: string },
): Promise<TelecrmConsultationQuoteDto> {
  const res = await fetch(`${API}/link-inquiry`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(body),
  });
  const data = await parseJson<{ quote: TelecrmConsultationQuoteDto }>(res);
  return data.quote;
}
