import type { OutboundEmailPurpose } from '@shared/outboundEmailPurpose';

export type { OutboundEmailPurpose };

export type PlatformSmtpProfileDto = {
  id: string;
  slug: string;
  label: string;
  enabled: boolean;
  purposes: OutboundEmailPurpose[];
  smtp: {
    host: string;
    port: number;
    secure: boolean;
    user: string;
    from: string;
    passwordConfigured: boolean;
    configured: boolean;
  };
  defaultDisplayName: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export type PlatformSmtpPurposeCatalogItem = {
  id: OutboundEmailPurpose;
  label: string;
};

export type PlatformSmtpProfilePatch = {
  slug?: string;
  label?: string;
  enabled?: boolean;
  purposes?: OutboundEmailPurpose[];
  defaultDisplayName?: string | null;
  sortOrder?: number;
  smtp?: {
    host?: string;
    port?: number | null;
    secure?: boolean;
    user?: string;
    from?: string;
    password?: string;
  };
};

async function platformFetch<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`/api/platform/smtp-profiles${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `요청 실패 (${res.status})`);
  }
  return data;
}

export async function listPlatformSmtpProfiles(token: string): Promise<PlatformSmtpProfileDto[]> {
  const data = await platformFetch<{ items: PlatformSmtpProfileDto[] }>(token, '/');
  return data.items;
}

export async function getPlatformSmtpPurposeCatalog(
  token: string,
): Promise<PlatformSmtpPurposeCatalogItem[]> {
  const data = await platformFetch<{ items: PlatformSmtpPurposeCatalogItem[] }>(token, '/purposes');
  return data.items;
}

export async function createPlatformSmtpProfile(
  token: string,
  body: PlatformSmtpProfilePatch & { slug: string; label: string },
): Promise<PlatformSmtpProfileDto> {
  return platformFetch<PlatformSmtpProfileDto>(token, '/', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export async function updatePlatformSmtpProfile(
  token: string,
  id: string,
  body: PlatformSmtpProfilePatch,
): Promise<PlatformSmtpProfileDto> {
  return platformFetch<PlatformSmtpProfileDto>(token, `/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });
}

export async function deletePlatformSmtpProfile(token: string, id: string): Promise<void> {
  await platformFetch<{ ok: boolean }>(token, `/${encodeURIComponent(id)}`, {
    method: 'DELETE',
  });
}

export async function sendPlatformSmtpProfileTest(
  token: string,
  id: string,
  to: string,
): Promise<{ ok: boolean; message: string }> {
  return platformFetch<{ ok: boolean; message: string }>(token, `/${encodeURIComponent(id)}/test`, {
    method: 'POST',
    body: JSON.stringify({ to }),
  });
}
