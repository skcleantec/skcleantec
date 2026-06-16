/**
 * @generated-sync from shared/tenantHost.ts — 직접 수정하지 마세요.
 * 변경: shared/tenantHost.ts 수정 후 `npm run sync:tenant-host` (prebuild/predev 자동).
 */

import { DEFAULT_TENANT_SLUG } from '../modules/tenants/tenant.constants.js';

/** 테넌트 slug 가 아닌 웹 접두 서브도메인 — apex 와 동일하게 기본 테넌트 */
export const TENANT_HOST_RESERVED_SUBDOMAINS = ['www'] as const;

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

export function parseTenantHostList(raw: string | undefined): string[] {
  return (raw ?? '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function normalizeTenantHost(raw: string): string {
  const h = raw.trim().toLowerCase();
  return (h.split(':')[0] ?? h).replace(/\.$/, '');
}

export type ResolveTenantSlugFromHostParams = {
  hostRaw: string;
  baseDomain: string;
  platformSubdomain: string;
  aliasApexDomains?: readonly string[];
};

/**
 * Host → tenant slug (서브도메인 2차).
 * `acme.cbiseo.com` → `acme`, `cbiseo.com` / `www.cbiseo.com` → 기본 테넌트,
 * `skcleantec.com`(alias) → 기본 테넌트, `platform.cbiseo.com` → null.
 */
export function resolveTenantSlugFromHostCore(params: ResolveTenantSlugFromHostParams): string | null {
  const host = normalizeTenantHost(params.hostRaw);
  if (!host) return null;

  const baseDomain = params.baseDomain.trim().toLowerCase();
  const platformSub = params.platformSubdomain.trim().toLowerCase();
  const aliasApex = params.aliasApexDomains ?? [];

  if (!baseDomain) {
    if (host.endsWith('.localhost')) {
      const sub = host.slice(0, -'.localhost'.length);
      if (sub && sub !== platformSub && !isReservedWebSubdomain(sub) && SLUG_RE.test(sub)) return sub;
    }
    return null;
  }

  if (host === baseDomain || aliasApex.includes(host)) return DEFAULT_TENANT_SLUG;

  const suffix = `.${baseDomain}`;
  if (!host.endsWith(suffix)) return null;

  const subdomain = host.slice(0, -suffix.length);
  if (!subdomain || subdomain.includes('.')) return null;
  if (subdomain === platformSub) return null;
  if (isReservedWebSubdomain(subdomain)) return DEFAULT_TENANT_SLUG;
  if (!SLUG_RE.test(subdomain)) return null;
  return subdomain;
}

function isReservedWebSubdomain(sub: string): boolean {
  return (TENANT_HOST_RESERVED_SUBDOMAINS as readonly string[]).includes(sub);
}
