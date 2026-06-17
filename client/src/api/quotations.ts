import type {
  TenantCompanyRegistration,
  TenantSmtpSettingsPublic,
} from '@shared/tenantCompanyProfile';
import { API } from './apiPrefix';

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

export type QuotationStatus = 'DRAFT' | 'FINALIZED' | 'SENT';

export type QuotationDatePreset = 'today' | 'all' | 'month' | 'day';

export interface QuotationConfigDto {
  footerNotice: string | null;
  documentTitle: string | null;
  defaultValidDays: number | null;
  defaultEmailSubject: string | null;
  defaultEmailBody: string | null;
  updatedAt: string;
}

export interface QuotationEditorOperatingCompanyDto {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  isDefault: boolean;
  companyRegistration: TenantCompanyRegistration;
}

export interface QuotationEditorDefaultsDto {
  catalog: QuotationServiceItemDto[];
  config: QuotationConfigDto;
  validUntilDefault: string | null;
  operatingCompanies: QuotationEditorOperatingCompanyDto[];
  /** 테넌트 기본 사업자 — 브랜드별 값이 없을 때 보완용 */
  tenantCompanyRegistration: TenantCompanyRegistration;
  smtp: TenantSmtpSettingsPublic;
  globalSmtpFallbackAvailable: boolean;
}

export interface QuotationServiceItemDto {
  id: string;
  name: string;
  unitPrice: number;
  description: string | null;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type QuotationVatMode = 'TAX_FREE' | 'VAT_SEPARATE';

export interface QuotationLineItemDto {
  id?: string;
  catalogItemId?: string | null;
  label: string;
  unitPrice: number;
  quantity: number;
  lineAmount?: number;
  sortOrder?: number;
}

export interface QuotationEmailLogDto {
  id: string;
  to: string;
  subject: string;
  bodyPreview: string | null;
  sentAt: string;
  success: boolean;
  errorMessage: string | null;
  sentBy: { id: string; name: string } | null;
}

export interface QuotationEmailDefaultsDto {
  subject: string;
  body: string;
}

export interface QuotationDto {
  id: string;
  quoteNumber: string;
  status: QuotationStatus;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  customerAddress: string | null;
  memo: string | null;
  subtotal: number;
  discountAmount: number;
  total: number;
  vatMode: QuotationVatMode;
  vatAmount: number;
  grandTotal: number;
  validUntil: string | null;
  inquiryId: string | null;
  operatingCompanyId: string | null;
  operatingCompany: QuotationEditorOperatingCompanyDto | null;
  sentAt: string | null;
  lastEmailedAt: string | null;
  pdfSecureUrl: string | null;
  createdAt: string;
  updatedAt: string;
  lineItems: QuotationLineItemDto[];
  createdBy?: { id: string; name: string; email: string; role: string } | null;
  inquiry?: { id: string; inquiryNumber: string | null; customerName: string } | null;
}

export async function listQuotationServiceItems(
  token: string,
  opts?: { includeInactive?: boolean },
): Promise<QuotationServiceItemDto[]> {
  const path = opts?.includeInactive ? '/service-items/all' : '/service-items';
  const res = await fetch(`${API}/quotations${path}`, { headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { items: QuotationServiceItemDto[] };
  return data.items;
}

export async function createQuotationServiceItem(
  token: string,
  body: { name: string; unitPrice: number; description?: string | null; sortOrder?: number },
): Promise<QuotationServiceItemDto> {
  const res = await fetch(`${API}/quotations/service-items`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<QuotationServiceItemDto>;
}

export async function updateQuotationServiceItem(
  token: string,
  id: string,
  body: Partial<{
    name: string;
    unitPrice: number;
    description: string | null;
    sortOrder: number;
    isActive: boolean;
  }>,
): Promise<QuotationServiceItemDto> {
  const res = await fetch(`${API}/quotations/service-items/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<QuotationServiceItemDto>;
}

export async function deleteQuotationServiceItem(
  token: string,
  id: string,
  password: string,
): Promise<void> {
  const res = await fetch(`${API}/quotations/service-items/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(token),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function moveQuotationServiceItem(
  token: string,
  id: string,
  direction: 'up' | 'down',
): Promise<QuotationServiceItemDto[]> {
  const res = await fetch(`${API}/quotations/service-items/${encodeURIComponent(id)}/move`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ direction }),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { items: QuotationServiceItemDto[] };
  return data.items;
}

export async function fetchQuotationConfig(token: string): Promise<QuotationConfigDto> {
  const res = await fetch(`${API}/quotations/config`, { headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<QuotationConfigDto>;
}

export async function updateQuotationConfig(
  token: string,
  body: Partial<{
    footerNotice: string | null;
    documentTitle: string | null;
    defaultValidDays: number | null;
    defaultEmailSubject: string | null;
    defaultEmailBody: string | null;
  }>,
): Promise<QuotationConfigDto> {
  const res = await fetch(`${API}/quotations/config`, {
    method: 'PUT',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<QuotationConfigDto>;
}

export async function fetchQuotationEditorDefaults(
  token: string,
): Promise<QuotationEditorDefaultsDto> {
  const res = await fetch(`${API}/quotations/editor-defaults`, { headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<QuotationEditorDefaultsDto>;
}

export async function listQuotations(
  token: string,
  params?: {
    limit?: number;
    offset?: number;
    customerName?: string;
    status?: QuotationStatus | '';
    datePreset?: QuotationDatePreset;
    month?: string;
    day?: string;
    inquiryId?: string;
  },
): Promise<{ items: QuotationDto[]; total: number }> {
  const qs = new URLSearchParams();
  if (params?.limit != null) qs.set('limit', String(params.limit));
  if (params?.offset != null) qs.set('offset', String(params.offset));
  if (params?.customerName?.trim()) qs.set('customerName', params.customerName.trim());
  if (params?.status) qs.set('status', params.status);
  if (params?.inquiryId?.trim()) qs.set('inquiryId', params.inquiryId.trim());
  if (params?.datePreset && params.datePreset !== 'all') {
    qs.set('datePreset', params.datePreset);
    if (params.datePreset === 'month' && params.month) qs.set('month', params.month);
    if (params.datePreset === 'day' && params.day) qs.set('day', params.day);
  }
  const q = qs.toString();
  const res = await fetch(`${API}/quotations${q ? `?${q}` : ''}`, { headers: headers(token) });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<{ items: QuotationDto[]; total: number }>;
}

export async function getQuotation(token: string, id: string): Promise<QuotationDto> {
  const res = await fetch(`${API}/quotations/${encodeURIComponent(id)}`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<QuotationDto>;
}

export async function createQuotation(
  token: string,
  body: {
    customerName: string;
    customerPhone?: string | null;
    customerEmail?: string | null;
    customerAddress?: string | null;
    memo?: string | null;
    discountAmount?: number;
    validUntil?: string | null;
    inquiryId?: string | null;
    operatingCompanyId?: string | null;
    vatMode?: QuotationVatMode;
    lineItems: QuotationLineItemDto[];
  },
): Promise<QuotationDto> {
  const res = await fetch(`${API}/quotations`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<QuotationDto>;
}

export async function updateQuotation(
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
    status: QuotationStatus;
    vatMode?: QuotationVatMode;
    inquiryId?: string | null;
    operatingCompanyId?: string | null;
    lineItems: QuotationLineItemDto[];
  }>,
): Promise<QuotationDto> {
  const res = await fetch(`${API}/quotations/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<QuotationDto>;
}

export async function deleteQuotation(token: string, id: string, password: string): Promise<void> {
  const res = await fetch(`${API}/quotations/${encodeURIComponent(id)}`, {
    method: 'DELETE',
    headers: headers(token),
    body: JSON.stringify({ password }),
  });
  if (!res.ok) throw new Error(await readError(res));
}

export async function downloadQuotationPdf(
  token: string,
  id: string,
  opts?: { preview?: boolean },
): Promise<Blob> {
  const qs = opts?.preview ? '?inline=1' : '';
  const res = await fetch(`${API}/quotations/${encodeURIComponent(id)}/pdf${qs}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readError(res));
  const contentType = res.headers.get('content-type') ?? '';
  if (!contentType.includes('application/pdf')) {
    throw new Error(await readError(res));
  }
  return res.blob();
}

export async function fetchQuotationEmailDefaults(
  token: string,
  id: string,
): Promise<QuotationEmailDefaultsDto> {
  const res = await fetch(`${API}/quotations/${encodeURIComponent(id)}/email-defaults`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await readError(res));
  return res.json() as Promise<QuotationEmailDefaultsDto>;
}

export async function fetchQuotationEmailLogs(
  token: string,
  id: string,
): Promise<QuotationEmailLogDto[]> {
  const res = await fetch(`${API}/quotations/${encodeURIComponent(id)}/email-logs`, {
    headers: headers(token),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { items: QuotationEmailLogDto[] };
  return data.items;
}

export type QuotationEmailSendPayload = {
  to?: string;
  subject?: string;
  body?: string;
};

export async function sendQuotationEmail(
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
  const res = await fetch(`${API}/quotations/${encodeURIComponent(id)}/send-email`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { quotation: QuotationDto };
  return data.quotation;
}

export async function resendQuotationEmail(
  token: string,
  id: string,
  payload?: QuotationEmailSendPayload,
): Promise<QuotationDto> {
  const res = await fetch(`${API}/quotations/${encodeURIComponent(id)}/resend-email`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(payload ?? {}),
  });
  if (!res.ok) throw new Error(await readError(res));
  const data = (await res.json()) as { quotation: QuotationDto };
  return data.quotation;
}
