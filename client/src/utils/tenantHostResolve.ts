/**
 * Host → tenant slug (클라이언트 서브도메인 2차)
 * 서버 `tenantHostResolve.ts` 와 동일 규칙 — Vite env 로 base domain 설정
 */

import { DEFAULT_TENANT_SLUG } from '@shared/tenantFeatureModules';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

function normalizeHost(raw: string): string {
  const h = raw.trim().toLowerCase();
  return (h.split(':')[0] ?? h).replace(/\.$/, '');
}

function baseDomainFromEnv(): string {
  const v = import.meta.env.VITE_TENANT_HOST_BASE_DOMAIN;
  return typeof v === 'string' ? v.trim().toLowerCase() : '';
}

function platformSubFromEnv(): string {
  const v = import.meta.env.VITE_PLATFORM_HOST_SUBDOMAIN;
  return typeof v === 'string' && v.trim() ? v.trim().toLowerCase() : 'platform';
}

export function resolveTenantSlugFromHost(
  hostRaw: string,
  opts?: { baseDomain?: string; platformSubdomain?: string },
): string | null {
  const host = normalizeHost(hostRaw);
  if (!host) return null;

  const baseDomain = (opts?.baseDomain ?? baseDomainFromEnv()).trim().toLowerCase();
  const platformSub = (opts?.platformSubdomain ?? platformSubFromEnv()).trim().toLowerCase();

  if (!baseDomain) {
    if (host.endsWith('.localhost')) {
      const sub = host.slice(0, -'.localhost'.length);
      if (sub && sub !== platformSub && SLUG_RE.test(sub)) return sub;
    }
    return null;
  }

  if (host === baseDomain) return DEFAULT_TENANT_SLUG;

  const suffix = `.${baseDomain}`;
  if (!host.endsWith(suffix)) return null;

  const subdomain = host.slice(0, -suffix.length);
  if (!subdomain || subdomain.includes('.')) return null;
  if (subdomain === platformSub) return null;
  if (!SLUG_RE.test(subdomain)) return null;
  return subdomain;
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
