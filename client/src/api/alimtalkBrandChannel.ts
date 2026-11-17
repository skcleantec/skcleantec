import { API } from './apiPrefix';
import { getPlatformToken } from '../stores/platformAuth';
import { getToken } from '../stores/auth';

export type BrandChannelBadge = { label: string; tone: 'emerald' | 'amber' | 'slate' };

export type TenantBrandChannelView = {
  setupFeeKrw: number;
  customCopyFeeKrw: number;
  brands: {
    operatingCompanyId: string;
    name: string;
    channel: {
      id: string;
      searchId: string;
      adminPhone: string;
      bizVerify: string;
      status: string;
      badge: BrandChannelBadge;
      setupFeeKrw: number;
      step: number;
      approved: number;
      templateCount: number;
      note: string;
    } | null;
  }[];
};

async function tenantJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getToken() ?? ''}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : '요청을 처리하지 못했습니다.');
  return data;
}

async function platformJson<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${getPlatformToken() ?? ''}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(typeof data.error === 'string' ? data.error : '요청을 처리하지 못했습니다.');
  return data;
}

export function fetchTenantBrandChannels(): Promise<TenantBrandChannelView> {
  return tenantJson('/alimtalk/brand-channels');
}

export function requestTenantBrandChannel(body: {
  operatingCompanyId: string;
  searchId: string;
  adminPhone: string;
  bizVerify: string;
  publicReady: boolean;
  feeAccepted: boolean;
}): Promise<{ ok: true }> {
  return tenantJson('/alimtalk/brand-channels', { method: 'POST', body: JSON.stringify(body) });
}

export type PlatformBrandChannelReview = {
  lastCheckedAt: string | null;
  fees: { setupFeeKrw: number; customCopyFeeKrw: number };
  summary: { linked: number; inReview: number; rejected: number; ready: number; needsLink: number };
  rows: {
    id: string;
    tenantId: string;
    tenantName: string;
    brandName: string;
    searchId: string;
    status: string;
    approved: number;
    templateCount: number;
    templates: { label: string; status: string; statusLabel: string; rejectReason: string | null }[];
  }[];
};

export function fetchPlatformBrandChannelReview(): Promise<PlatformBrandChannelReview> {
  return platformJson('/platform/alimtalk/brand-channels');
}

export function syncPlatformBrandChannels(): Promise<{ checked: number; lastCheckedAt: string | null }> {
  return platformJson('/platform/alimtalk/brand-channels/sync', { method: 'POST' });
}

export function savePlatformBrandChannelFees(body: { setupFeeKrw: number; customCopyFeeKrw: number }) {
  return platformJson('/platform/alimtalk/brand-channel-fees', { method: 'PATCH', body: JSON.stringify(body) });
}

export function fetchRemoteKakaoChannels(): Promise<{
  channels: { channelId: string; channelName: string; usedBy: string | null }[];
}> {
  return platformJson('/platform/alimtalk/brand-channels/remote');
}

export type PlatformTenantBrandRow = {
  operatingCompanyId: string;
  name: string;
  channelId: string | null;
  searchId: string | null;
  status: string | null;
  badge: BrandChannelBadge;
  approved: number;
  templateCount: number;
  templates: {
    label: string;
    statusLabel: string;
    status: string;
    rejectReason: string | null;
    submittedAt: string | null;
    sendsFrom: string;
  }[];
};

export function fetchPlatformTenantBrandChannels(tenantId: string): Promise<{ brands: PlatformTenantBrandRow[] }> {
  return platformJson(`/platform/alimtalk/tenants/${tenantId}/brand-channels`);
}

export function linkPlatformBrandChannel(
  tenantId: string,
  body: { operatingCompanyId: string; providerChannelId: string; createTemplates: boolean },
) {
  return platformJson(`/platform/alimtalk/tenants/${tenantId}/brand-channels/link`, {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function disconnectPlatformBrandChannel(tenantId: string, channelId: string) {
  return platformJson(`/platform/alimtalk/tenants/${tenantId}/brand-channels/${channelId}/disconnect`, { method: 'POST' });
}

export function excludePlatformBrandChannelFee(tenantId: string, channelId: string) {
  return platformJson(`/platform/alimtalk/tenants/${tenantId}/brand-channels/${channelId}/exclude-fee`, { method: 'POST' });
}

export function openPlatformTemplateReview() {
  return platformJson<{ url: string }>('/platform/alimtalk/barobill/url', {
    method: 'POST',
    body: JSON.stringify({ kind: 'template' }),
  });
}

export function openPlatformChannelAdmin() {
  return platformJson<{ url: string }>('/platform/alimtalk/barobill/url', {
    method: 'POST',
    body: JSON.stringify({ kind: 'channel' }),
  });
}
