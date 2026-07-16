import { API } from './apiPrefix';
import { withTeamPreviewQuery } from '../utils/teamPreviewQuery';
import type {
  QuotationDto,
  QuotationEditorDefaultsDto,
  QuotationEmailDefaultsDto,
  QuotationEmailLogDto,
  QuotationEmailSendPayload,
  QuotationLineItemDto,
  QuotationStatus,
  QuotationVatMode,
} from './quotations';
import type { QuotationDocumentType } from '@shared/quotationDocument';

export type {
  QuotationDto,
  QuotationEditorDefaultsDto,
  QuotationEditorOperatingCompanyDto,
  QuotationLineItemDto,
  QuotationServiceItemDto,
  QuotationStatus,
  QuotationVatMode,
} from './quotations';

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

async function readError(res: Response): Promise<string> {
  const ct = res.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    if (typeof data.error === 'string' && data.error.trim()) return data.error;
  } else {
    const text = await res.text().catch(() => '');
    if (text.trim()) return text.trim().slice(0, 200);
  }
  return res.statusText?.trim() ? `${res.status} ${res.statusText}` : '요청에 실패했습니다.';
}

function teamUrl(path: string): string {
  return withTeamPreviewQuery(`${API}/team/quotations${path}`);
}

export async function fetchTeamQuotationEditorDefaults(
  token: string,
): Promise<QuotationEditorDefaultsDto> {
  const res = await fetch(teamUrl('/editor-defaults'), { headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<QuotationEditorDefaultsDto>;
}

export async function listTeamQuotations(
  token: string,
  params?: {
    limit?: number;
    offset?: number;
    inquiryId?: string;
    datePreset?: 'today' | 'all' | 'month' | 'day';
    month?: string;
    day?: string;
  },
): Promise<{ items: QuotationDto[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  if (params?.inquiryId?.trim()) qs.set('inquiryId', params.inquiryId.trim());
  if (params?.datePreset && params.datePreset !== 'all') {
    qs.set('datePreset', params.datePreset);
    if (params.datePreset === 'month' && params.month) qs.set('month', params.month);
    if (params.datePreset === 'day' && params.day) qs.set('day', params.day);
  }
  const q = qs.toString();
  const res = await fetch(teamUrl(q ? `/?${q}` : '/'), { headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<{ items: QuotationDto[]; total: number }>;
}

export async function getTeamQuotation(token: string, id: string): Promise<QuotationDto> {
  const res = await fetch(teamUrl(`/${encodeURIComponent(id)}`), {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<QuotationDto>;
}

export async function createTeamQuotation(
  token: string,
  body: {
    inquiryId: string;
    customerName: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
    customerAddress?: string | null;
    memo?: string | null;
    discountAmount?: number;
    validUntil?: string | null;
    documentType?: QuotationDocumentType;
    operatingCompanyId?: string | null;
    vatMode?: QuotationVatMode;
    lineItems: QuotationLineItemDto[];
  },
): Promise<QuotationDto> {
  const res = await fetch(teamUrl('/'), {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<QuotationDto>;
}

export async function updateTeamQuotation(
  token: string,
  id: string,
  body: Partial<{
    customerName: string;
    customerPhone: string | null;
    customerEmail: string | null;
    customerAddress: string | null;
    memo: string | null;
    discountAmount: number;
    validUntil: string | null;
    documentType?: QuotationDocumentType;
    status: QuotationStatus;
    vatMode?: QuotationVatMode;
    operatingCompanyId?: string | null;
    lineItems: QuotationLineItemDto[];
  }>,
): Promise<QuotationDto> {
  const res = await fetch(teamUrl(`/${encodeURIComponent(id)}`), {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<QuotationDto>;
}

export async function deleteTeamQuotation(token: string, id: string, password: string): Promise<void> {
  const res = await fetch(teamUrl(`/${encodeURIComponent(id)}`), {
    method: 'DELETE',
    headers: headers(token),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function downloadTeamQuotationPdf(
  token: string,
  id: string,
  opts?: { preview?: boolean },
): Promise<Blob> {
  const qs = opts?.preview ? '?inline=1' : '';
  const res = await fetch(teamUrl(`/${encodeURIComponent(id)}/pdf${qs}`), {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readError(res));
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/pdf')) {
    throw new Error(await readError(res));
  }
  return res.blob();
}

export async function fetchTeamQuotationEmailDefaults(
  token: string,
  id: string,
): Promise<QuotationEmailDefaultsDto> {
  const res = await fetch(teamUrl(`/${encodeURIComponent(id)}/email-defaults`), {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<QuotationEmailDefaultsDto>;
}

export async function fetchTeamQuotationEmailLogs(
  token: string,
  id: string,
): Promise<QuotationEmailLogDto[]> {
  const res = await fetch(teamUrl(`/${encodeURIComponent(id)}/email-logs`), {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { items: QuotationEmailLogDto[] };
  return data.items;
}

export async function sendTeamQuotationEmail(
  token: string,
  id: string,
  payload?: QuotationEmailSendPayload | string,
): Promise<QuotationDto> {
  const body =
    typeof payload === 'string'
      ? { to: payload }
      : payload && Object.keys(payload).length > 0
        ? payload
        : {};
  const res = await fetch(teamUrl(`/${encodeURIComponent(id)}/send-email`), {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { quotation: QuotationDto };
  return data.quotation;
}

export async function resendTeamQuotationEmail(
  token: string,
  id: string,
  payload?: QuotationEmailSendPayload,
): Promise<QuotationDto> {
  const res = await fetch(teamUrl(`/${encodeURIComponent(id)}/resend-email`), {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(payload ?? {}),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { quotation: QuotationDto };
  return data.quotation;
}
