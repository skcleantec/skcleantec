/**
 * Host → tenant slug (클라이언트 서브도메인 2차)
 * 서버 `tenantHostResolve.ts` 와 동일 규칙 — Vite env 로 base domain 설정
 */

import { parseTenantHostList, resolveTenantSlugFromHostCore } from '@shared/tenantHost';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

function baseDomainFromEnv(): string {
  const v = import.meta.env.VITE_TENANT_HOST_BASE_DOMAIN;
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

function platformSubFromEnv(): string {
  const v = import.meta.env.VITE_PLATFORM_HOST_SUBDOMAIN;
  return typeof v === 'string' && v.trim() ? v.trim().toLowerCase() : 'platform';
}

function aliasApexFromEnv(): string[] {
  const v = import.meta.env.VITE_TENANT_HOST_ALIAS_DOMAINS;
  return typeof v === 'string' ? parseTenantHostList(v) : [];
}

export function resolveTenantSlugFromHost(
  hostRaw: string,
  opts?: {
    baseDomain?: string;
    platformSubdomain?: string;
    aliasApexDomains?: readonly string[];
  },
): string | null {
  return resolveTenantSlugFromHostCore({
    hostRaw,
    baseDomain: opts?.baseDomain ?? baseDomainFromEnv(),
    platformSubdomain: opts?.platformSubdomain ?? platformSubFromEnv(),
    aliasApexDomains: opts?.aliasApexDomains ?? aliasApexFromEnv(),
  });
}

/** URL ?tenant= → Host subdomain → localStorage 순 */
export function resolveInitialTenantSlug(): string {
  try {
    const params = new URLSearchParams(window.location.search);
    const q = params.get('tenant')?.trim().toLowerCase();
    if (q && SLUG_RE.test(q)) return q;
  } catch {
    /* ignore */
  }

  const fromHost = resolveTenantSlugFromHost(window.location.hostname);
  if (fromHost) return fromHost;

  return loadTenantSlugFromStorage();
}

function loadTenantSlugFromStorage(): string {
  try {
    return localStorage.getItem('sk_tenant_slug')?.trim().toLowerCase() ?? '';
  } catch {
    return '';
  }
}

export async function resolveTenantSlugWithApiFallback(): Promise<string> {
  const local = resolveInitialTenantSlug();
  const fromHost = resolveTenantSlugFromHost(window.location.hostname);
  if (fromHost) return fromHost;

  try {
    const res = await fetch('/api/tenant/resolve-host');
    if (res.ok) {
      const body = (await res.json()) as { slug?: string | null; resolved?: boolean };
      if (body.resolved && body.slug) return body.slug;
    }
  } catch {
    /* offline / dev */
  }

  return local;
}
