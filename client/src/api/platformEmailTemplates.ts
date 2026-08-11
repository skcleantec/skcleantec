import type { OutboundEmailPurpose } from '@shared/outboundEmailPurpose';

export type PlatformEmailTemplateDto = {
  purpose: OutboundEmailPurpose;
  label: string;
  enabled: boolean;
  subjectTemplate: string;
  headline: string;
  preheader: string | null;
  introHtml: string;
  footerHtml: string;
  noreplyNoticeHtml: string;
  updatedAt: string;
  updatedByEmail: string | null;
  isConfigured: boolean;
};

export type PlatformEmailTemplatePatch = {
  label?: string;
  enabled?: boolean;
  subjectTemplate?: string;
  headline?: string;
  preheader?: string | null;
  introHtml?: string;
  footerHtml?: string;
  noreplyNoticeHtml?: string;
};

export type PlatformEmailPlaceholderDef = {
  key: string;
  label: string;
  sample: string;
};

async function platformFetch<T>(
  token: string,
  path: string,
  init?: RequestInit,
): Promise<T> {
  const res = await fetch(`/api/platform/email-templates${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.headers ?? {}),
    },
  });
  const data = (await res.json().catch(() => ({}))) as T & { error?: string };
  if (!res.ok) throw new Error(data.error ?? `요청 실패 (${res.status})`);
  return data;
}

export async function listPlatformEmailTemplates(token: string): Promise<PlatformEmailTemplateDto[]> {
  const data = await platformFetch<{ items: PlatformEmailTemplateDto[] }>(token, '/');
  return data.items;
}

export async function getPlatformEmailTemplateCatalog(token: string): Promise<{
  items: Array<{ purpose: OutboundEmailPurpose; label: string }>;
  subjectPlaceholders: PlatformEmailPlaceholderDef[];
  bodyPlaceholders: Record<OutboundEmailPurpose, PlatformEmailPlaceholderDef[]>;
}> {
  return platformFetch(token, '/purposes');
}

export type PlatformEmailTemplateBrandDefaults = {
  purpose: OutboundEmailPurpose;
  label: string;
  subjectTemplate: string;
  headline: string;
  preheader: string;
  introHtml: string;
  footerHtml: string;
  noreplyNoticeHtml: string;
};

export async function getPlatformEmailTemplateBrandDefaults(
  token: string,
  purpose: OutboundEmailPurpose,
): Promise<PlatformEmailTemplateBrandDefaults> {
  return platformFetch(token, `/${purpose}/brand-defaults`);
}

export async function patchPlatformEmailTemplate(
  token: string,
  purpose: OutboundEmailPurpose,
  patch: PlatformEmailTemplatePatch,
): Promise<PlatformEmailTemplateDto> {
  return platformFetch(token, `/${purpose}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
