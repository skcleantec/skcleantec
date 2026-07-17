import type { SoomgoBridgeManifest } from '@shared/soomgoBridge';
import { appendCrmWorkBrandQuery } from '../utils/crmWorkBrandQuery';

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

export type TelecrmSoomgoBrandConfigDto = {
  id: string;
  name: string;
  displayName: string;
  slug: string;
  isActive: boolean;
  isDefault: boolean;
  soomgo: {
    email: string;
    enabled: boolean;
    hasPassword: boolean;
    configured: boolean;
  };
};

export async function fetchTelecrmSoomgoConfig(token: string): Promise<TelecrmSoomgoConfigDto> {
  const res = await fetch(`${API}/config`, { headers: authHeaders(token) });
  const data = (await res.json()) as TelecrmSoomgoConfigDto & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '숨고 설정을 불러오지 못했습니다.');
  return data;
}

export async function updateTelecrmSoomgoConfig(
  token: string,
  input: {
    email: string;
    password?: string;
    enabled: boolean;
    actorPassword?: string;
  },
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

export async function fetchTelecrmSoomgoBrandConfigs(
  token: string,
): Promise<TelecrmSoomgoBrandConfigDto[]> {
  const res = await fetch(`${API}/brand-configs`, { headers: authHeaders(token) });
  const data = (await res.json()) as { items?: TelecrmSoomgoBrandConfigDto[]; error?: string };
  if (!res.ok) throw new Error(data.error ?? '브랜드 숨고 설정을 불러오지 못했습니다.');
  return data.items ?? [];
}

export async function updateTelecrmSoomgoBrandConfig(
  token: string,
  operatingCompanyId: string,
  input: {
    email: string;
    password?: string;
    enabled: boolean;
    actorPassword?: string;
  },
): Promise<TelecrmSoomgoBrandConfigDto> {
  const res = await fetch(`${API}/brand-configs/${encodeURIComponent(operatingCompanyId)}`, {
    method: 'PUT',
    headers: authHeaders(token),
    body: JSON.stringify(input),
  });
  const data = (await res.json()) as TelecrmSoomgoBrandConfigDto & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '브랜드 숨고 설정 저장에 실패했습니다.');
  return data;
}

export async function fetchTelecrmSoomgoCredentials(
  token: string,
  operatingCompanyId?: string | null,
): Promise<{ email: string; password: string }> {
  const qs = new URLSearchParams();
  appendCrmWorkBrandQuery(qs, operatingCompanyId);
  const q = qs.toString() ? `?${qs}` : '';
  const res = await fetch(`${API}/credentials${q}`, { headers: authHeaders(token) });
  const data = (await res.json()) as { email?: string; password?: string; error?: string };
  if (!res.ok) throw new Error(data.error ?? '숨고 계정 정보를 불러오지 못했습니다.');
  if (!data.email || !data.password) throw new Error('숨고 계정이 설정되지 않았습니다.');
  return { email: data.email, password: data.password };
}

export async function fetchTelecrmSoomgoBridgeManifest(token: string): Promise<SoomgoBridgeManifest> {
  const res = await fetch(`${API}/bridge-manifest?_=${Date.now()}`, {
    headers: authHeaders(token),
    cache: 'no-store',
  });
  const data = (await res.json()) as SoomgoBridgeManifest & { error?: string };
  if (!res.ok) throw new Error(data.error ?? '브릿지 배포 정보를 불러오지 못했습니다.');
  return data;
}
