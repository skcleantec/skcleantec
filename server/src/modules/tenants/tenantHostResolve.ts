import { config } from '../../config/index.js';
import { DEFAULT_TENANT_SLUG } from './tenant.constants.js';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

function normalizeHost(raw: string): string {
  const h = raw.trim().toLowerCase();
  const withoutPort = h.split(':')[0] ?? h;
  return withoutPort.replace(/\.$/, '');
}

/**
 * Host 헤더 → tenant slug (서브도메인).
 * `acme.app.example.com` + base `app.example.com` → `acme`
 * `platform.app.example.com` → null (플랫폼 전용)
 */
export function resolveTenantSlugFromHost(
  hostRaw: string,
  opts?: { baseDomain?: string; platformSubdomain?: string },
): string | null {
  const host = normalizeHost(hostRaw);
  if (!host) return null;

  const baseDomain = (opts?.baseDomain ?? config.tenantHost.baseDomain).trim().toLowerCase();
  const platformSub = (opts?.platformSubdomain ?? config.tenantHost.platformSubdomain).trim().toLowerCase();

  if (!baseDomain) {
    // 로컬: acme.localhost
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

export function readRequestHost(headers: Record<string, unknown>): string {
  const xf = headers['x-forwarded-host'];
  if (typeof xf === 'string' && xf.trim()) {
    return xf.split(',')[0]!.trim();
  }
  const host = headers.host;
  if (typeof host === 'string' && host.trim()) return host.trim();
  return '';
}
