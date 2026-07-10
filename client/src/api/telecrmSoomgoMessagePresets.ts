import type {
  SoomgoMessagePresetDto,
  SoomgoMessageStep,
  SoomgoAutoMessagePresetDto,
  SoomgoQuoteAutoMessagePresetDto,
} from '@shared/soomgoMessagePresets';
import type { SoomgoIntakeAutoTriggerKind } from '@shared/soomgoMessagePresets';

const API = '/api/crm';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export type { SoomgoMessagePresetDto, SoomgoMessageStep };

export async function fetchTelecrmSoomgoMessagePresets(
  token: string,
  opts?: { scope?: 'work' | 'shared' | 'personal'; includeInactive?: boolean },
): Promise<{ presets: SoomgoMessagePresetDto[] }> {
  const q = new URLSearchParams();
  if (opts?.scope) q.set('scope', opts.scope);
  if (opts?.includeInactive) q.set('includeInactive', '1');
  const res = await fetch(`${API}/soomgo-message-presets?${q}`, { headers: authHeaders(token) });
  const data = (await res.json()) as { error?: string; presets?: SoomgoMessagePresetDto[] };
  if (!res.ok) throw new Error(data.error ?? '숨고 메시지 프리셋을 불러올 수 없습니다.');
  return { presets: data.presets ?? [] };
}

export async function createTelecrmSoomgoMessagePreset(
  token: string,
  input: {
    label: string;
    steps: SoomgoMessageStep[];
    ownerScope?: 'shared' | 'personal';
    sortOrder?: number;
  },
): Promise<SoomgoMessagePresetDto> {
  const res = await fetch(`${API}/soomgo-message-presets`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as SoomgoMessagePresetDto & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '프리셋 추가 실패');
  return data;
}

export async function updateTelecrmSoomgoMessagePreset(
  token: string,
  id: string,
  patch: Partial<Pick<SoomgoMessagePresetDto, 'label' | 'steps' | 'slotNumber' | 'sortOrder' | 'isActive'>>,
): Promise<SoomgoMessagePresetDto> {
  const res = await fetch(`${API}/soomgo-message-presets/${id}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify(patch),
  });
  const data = (await res.json()) as SoomgoMessagePresetDto & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '프리셋 수정 실패');
  return data;
}

export async function deleteTelecrmSoomgoMessagePreset(token: string, id: string, password: string): Promise<void> {
  const res = await fetch(`${API}/soomgo-message-presets/${id}`, {
    method: 'DELETE',
    headers: authHeaders(token),
    body: JSON.stringify({ password }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error ?? '프리셋 삭제 실패');
}

export async function fetchTelecrmSoomgoAutoMessages(token: string): Promise<{
  items: SoomgoAutoMessagePresetDto[];
}> {
  const res = await fetch(`${API}/soomgo-message-presets/auto-messages`, { headers: authHeaders(token) });
  const data = (await res.json()) as { error?: string; items?: SoomgoAutoMessagePresetDto[] };
  if (!res.ok) throw new Error(data.error ?? '자동 메시지 설정을 불러올 수 없습니다.');
  return { items: data.items ?? [] };
}

export async function updateTelecrmSoomgoAutoMessage(
  token: string,
  triggerKind: SoomgoIntakeAutoTriggerKind,
  input: { steps: SoomgoMessageStep[]; isActive: boolean },
): Promise<SoomgoAutoMessagePresetDto> {
  const res = await fetch(`${API}/soomgo-message-presets/auto-messages/${encodeURIComponent(triggerKind)}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as SoomgoAutoMessagePresetDto & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '자동 메시지 저장 실패');
  return data;
}

export async function fetchTelecrmSoomgoQuoteAutoMessage(
  token: string,
  operatingCompanyId?: string | null,
): Promise<{
  item: SoomgoQuoteAutoMessagePresetDto;
  fallbackFromDefault?: boolean;
  defaultItem?: SoomgoQuoteAutoMessagePresetDto;
}> {
  const q = new URLSearchParams();
  if (operatingCompanyId) q.set('operatingCompanyId', operatingCompanyId);
  const res = await fetch(`${API}/soomgo-message-presets/auto-messages/auto_quote?${q}`, {
    headers: authHeaders(token),
  });
  const data = (await res.json()) as {
    error?: string;
    item?: SoomgoQuoteAutoMessagePresetDto;
    fallbackFromDefault?: boolean;
    defaultItem?: SoomgoQuoteAutoMessagePresetDto;
  };
  if (!res.ok) throw new Error(data.error ?? '견적보내기 설정을 불러올 수 없습니다.');
  if (!data.item) throw new Error('견적보내기 설정을 불러올 수 없습니다.');
  return {
    item: data.item,
    fallbackFromDefault: data.fallbackFromDefault,
    defaultItem: data.defaultItem,
  };
}

export async function resolveTelecrmSoomgoQuoteAutoMessageForSend(
  token: string,
  operatingCompanyId?: string | null,
): Promise<{ item: SoomgoQuoteAutoMessagePresetDto | null }> {
  const q = new URLSearchParams();
  if (operatingCompanyId) q.set('operatingCompanyId', operatingCompanyId);
  const res = await fetch(`${API}/soomgo-message-presets/auto-messages/auto_quote/resolve?${q}`, {
    headers: authHeaders(token),
  });
  const data = (await res.json()) as {
    error?: string;
    item?: SoomgoQuoteAutoMessagePresetDto | null;
  };
  if (!res.ok) throw new Error(data.error ?? '견적보내기 서식을 불러올 수 없습니다.');
  return { item: data.item ?? null };
}

export async function updateTelecrmSoomgoQuoteAutoMessage(
  token: string,
  input: {
    steps: SoomgoMessageStep[];
    isActive: boolean;
    paybackWon?: number | null;
    operatingCompanyId?: string | null;
  },
): Promise<SoomgoQuoteAutoMessagePresetDto> {
  const res = await fetch(`${API}/soomgo-message-presets/auto-messages/auto_quote`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as SoomgoQuoteAutoMessagePresetDto & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '견적보내기 설정 저장 실패');
  return data;
}

export async function uploadTelecrmSoomgoPresetImage(token: string, file: File): Promise<string> {
  const fd = new FormData();
  fd.append('image', file);
  const res = await fetch(`${API}/soomgo-message-presets/upload-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const data = (await res.json()) as { url?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? '이미지 업로드 실패');
  if (!data.url) throw new Error('이미지 URL을 받지 못했습니다.');
  return data.url;
}
