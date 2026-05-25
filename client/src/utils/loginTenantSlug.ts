/**
 * 로그인 폼용 업체 코드 — URL·서브도메인만 반영, apex 기본값(skcleanteck) 자동 입력 없음
 */
import { loadSavedLoginCredentials } from './loginCredentialsStorage';

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

function tenantSlugFromSubdomainHost(hostRaw: string): string | null {
  const host = normalizeHost(hostRaw);
  if (!host) return null;

  const baseDomain = baseDomainFromEnv();
  const platformSub = platformSubFromEnv();

  if (!baseDomain) {
    if (host.endsWith('.localhost')) {
      const sub = host.slice(0, -'.localhost'.length);
      if (sub && sub !== platformSub && SLUG_RE.test(sub)) return sub;
    }
    return null;
  }

  if (host === baseDomain) return null;

  const suffix = `.${baseDomain}`;
  if (!host.endsWith(suffix)) return null;

  const subdomain = host.slice(0, -suffix.length);
  if (!subdomain || subdomain.includes('.') || subdomain === platformSub) return null;
  if (!SLUG_RE.test(subdomain)) return null;
  return subdomain;
}

/** ?tenant= → 서브도메인 → (저장 체크 시) 저장값. 그 외 빈 문자열 */
export function resolveTenantSlugForLoginForm(): string {
  try {
    const q = new URLSearchParams(window.location.search).get('tenant')?.trim().toLowerCase();
    if (q && SLUG_RE.test(q)) return q;
  } catch {
    /* ignore */
  }

  const fromHost = tenantSlugFromSubdomainHost(window.location.hostname);
  if (fromHost) return fromHost;

  return loadSavedLoginCredentials()?.tenantSlug ?? '';
}
