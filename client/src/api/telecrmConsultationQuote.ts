import type {
  TelecrmConsultationQuotePayload,
  TelecrmConsultationQuoteStatus,
} from '@shared/telecrmConsultationQuote';

const API = '/api/telecrm/consultation-quotes';

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

async function parseJson(res: Response) {
  const data = await res.json();
  if (!res.ok) throw new Error(typeof data?.error === 'string' ? data.error : '요청 실패');
  return data;
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
  return parseJson(res);
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
  return parseJson(res);
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
  await parseJson(res);
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
  return parseJson(res);
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
  const data = await parseJson(res);
  return data.quote as TelecrmConsultationQuoteDto;
}
