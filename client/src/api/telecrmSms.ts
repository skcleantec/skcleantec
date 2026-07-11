const API = '/api/crm';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export type TelecrmSmsTemplateDto = {
  id: string;
  label: string;
  body: string;
  imageUrl: string | null;
  sortOrder: number;
  isActive: boolean;
  ownerUserId?: string | null;
  ownerScope?: 'shared' | 'personal';
  operatingCompanyId?: string | null;
};

export type TelecrmCallNoteDto = {
  id: string;
  phone: string;
  body: string;
  inquiryId: string | null;
  createdAt: string;
};

export async function fetchTelecrmSmsTemplates(
  token: string,
  opts?: {
    scope?: 'work' | 'shared' | 'personal';
    includeInactive?: boolean;
    operatingCompanyId?: string | null;
  },
): Promise<{ templates: TelecrmSmsTemplateDto[] }> {
  const q = new URLSearchParams();
  if (opts?.scope) q.set('scope', opts.scope);
  if (opts?.includeInactive) q.set('includeInactive', '1');
  if (opts?.operatingCompanyId) q.set('operatingCompanyId', opts.operatingCompanyId);
  const res = await fetch(`${API}/sms-templates?${q}`, { headers: authHeaders(token) });
  const data = (await res.json()) as { error?: string; templates?: TelecrmSmsTemplateDto[] };
  if (!res.ok) throw new Error(data.error ?? '문자 템플릿을 불러올 수 없습니다.');
  return { templates: data.templates ?? [] };
}

export async function createTelecrmSmsTemplate(
  token: string,
  input: {
    label: string;
    body: string;
    imageUrl?: string | null;
    ownerScope?: 'shared' | 'personal';
    operatingCompanyId?: string | null;
  },
): Promise<TelecrmSmsTemplateDto> {
  const res = await fetch(`${API}/sms-templates`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as TelecrmSmsTemplateDto & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '템플릿 추가 실패');
  return data;
}

export async function updateTelecrmSmsTemplate(
  token: string,
  id: string,
  patch: Partial<Pick<TelecrmSmsTemplateDto, 'label' | 'body' | 'imageUrl' | 'sortOrder' | 'isActive'>>,
): Promise<TelecrmSmsTemplateDto> {
  const res = await fetch(`${API}/sms-templates/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
  const data = (await res.json()) as TelecrmSmsTemplateDto & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '템플릿 수정 실패');
  return data;
}

export async function deleteTelecrmSmsTemplate(token: string, id: string, password: string): Promise<void> {
  const res = await fetch(`${API}/sms-templates/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ password }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? '템플릿 삭제 실패');
}

export async function uploadTelecrmSmsTemplateImage(token: string, file: File): Promise<string> {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch(`${API}/sms-templates/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? '이미지 업로드 실패');
  if (!data.url) throw new Error('이미지 URL을 받지 못했습니다.');
  return data.url;
}

export async function fetchTelecrmCallNotes(
  token: string,
  phone: string,
  limit = 30,
): Promise<{ items: TelecrmCallNoteDto[] }> {
  const digits = phone.replace(/\D/g, '');
  const res = await fetch(`${API}/call-notes?phone=${encodeURIComponent(digits)}&limit=${limit}`, {
    headers: authHeaders(token),
  });
  const data = (await res.json()) as { error?: string; items?: TelecrmCallNoteDto[] };
  if (!res.ok) throw new Error(data.error ?? '통화 메모를 불러올 수 없습니다.');
  return { items: data.items ?? [] };
}

export async function createTelecrmCallNote(
  token: string,
  input: { phone: string; body: string; inquiryId?: string | null },
): Promise<TelecrmCallNoteDto> {
  const res = await fetch(`${API}/call-notes`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({
      phone: input.phone.replace(/\D/g, ''),
      body: input.body,
      inquiryId: input.inquiryId ?? null,
    }),
  });
  const data = (await res.json()) as TelecrmCallNoteDto & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '통화 메모 저장 실패');
  return data;
}

export async function fetchTelecrmOrderFormLink(
  token: string,
  inquiryId: string,
): Promise<string | null> {
  const origin = window.location.origin;
  const res = await fetch(
    `${API}/order-form-link?inquiryId=${encodeURIComponent(inquiryId)}&origin=${encodeURIComponent(origin)}`,
    { headers: authHeaders(token) },
  );
  if (res.status === 404) return null;
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? '발주서 링크 조회 실패');
  return data.url ?? null;
}
