import type { SoomgoMessagePresetDto, SoomgoMessageStep } from '@shared/soomgoMessagePresets';

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
    slotNumber: number;
    ownerScope?: 'shared' | 'personal';
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
