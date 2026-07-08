import type { SoomgoBridgeManifest } from '@shared/soomgoBridge';

const API = '/api/crm/soomgo';

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
}

export type TelecrmSoomgoConfigDto = {
  email: string;
  hasPassword: boolean;
  enabled: boolean;
  updatedAt: string | null;
};

export async function fetchTelecrmSoomgoConfig(token: string): Promise<TelecrmSoomgoConfigDto> {
  const res = await fetch(`${API}/config`, { headers: authHeaders(token) });
  const data = (await res.json()) as TelecrmSoomgoConfigDto & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '숨고 설정을 불러오지 못했습니다.');
  return data;
}

export async function updateTelecrmSoomgoConfig(
  token: string,
  input: { email: string; password?: string; enabled: boolean; actorPassword?: string },
): Promise<TelecrmSoomgoConfigDto> {
  const res = await fetch(`${API}/config`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as TelecrmSoomgoConfigDto & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '숨고 설정 저장에 실패했습니다.');
  return data;
}

export async function fetchTelecrmSoomgoCredentials(
  token: string,
): Promise<{ email: string; password: string }> {
  const res = await fetch(`${API}/credentials`, { headers: authHeaders(token) });
  const data = (await res.json()) as { email?: string; password?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? '숨고 계정 정보를 불러오지 못했습니다.');
  if (!data.email || !data.password) throw new Error('숨고 계정이 설정되지 않았습니다.');
  return { email: data.email, password: data.password };
}

export async function fetchTelecrmSoomgoBridgeManifest(token: string): Promise<SoomgoBridgeManifest> {
  const res = await fetch(`${API}/bridge-manifest`, { headers: authHeaders(token) });
  const data = (await res.json()) as SoomgoBridgeManifest & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '브릿지 배포 정보를 불러오지 못했습니다.');
  return data;
}
