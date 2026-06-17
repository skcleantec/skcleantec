/**
 * 로그인 폼용 업체 코드 — URL·서브도메인만 반영, apex/www·기본 slug 자동 입력 없음
 */
import { TENANT_HOST_RESERVED_SUBDOMAINS } from '@shared/tenantHost';
import { loadSavedLoginCredentials } from './loginCredentialsStorage';
import { DEFAULT_TENANT_SLUG } from './tenantSlug';
import { resolveTenantSlugFromHost } from './tenantHostResolve';

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

const RESERVED_LOGIN_SLUGS = new Set<string>([
  ...(TENANT_HOST_RESERVED_SUBDOMAINS as readonly string[]),
]);

/** www 등 예약 서브도메인·잘못된 slug 는 로그인 업체 코드에서 제외 */
export function sanitizeLoginTenantSlug(raw: string): string {
  const s = raw.trim().toLowerCase();
  if (!s || !SLUG_RE.test(s)) return '';
  if (RESERVED_LOGIN_SLUGS.has(s)) return '';
  return s;
}

function tenantSlugFromHostForLogin(): string {
  const fromHost = resolveTenantSlugFromHost(window.location.hostname);
  if (!fromHost || fromHost === DEFAULT_TENANT_SLUG) return '';
  return sanitizeLoginTenantSlug(fromHost);
}

/** ?tenant= → 서브도메인(www·apex 제외) → (저장 체크 시) 저장값. 그 외 빈 문자열 */
export function resolveTenantSlugForLoginForm(): string {
  try {
    const q = new URLSearchParams(window.location.search).get('tenant')?.trim().toLowerCase();
    const fromQuery = q ? sanitizeLoginTenantSlug(q) : '';
    if (fromQuery) return fromQuery;
  } catch {
    /* ignore */
  }

  const fromHost = tenantSlugFromHostForLogin();
  if (fromHost) return fromHost;

  const saved = loadSavedLoginCredentials()?.tenantSlug ?? '';
  return sanitizeLoginTenantSlug(saved);
}
