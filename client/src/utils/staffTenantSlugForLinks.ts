import { DEFAULT_TENANT_SLUG } from './tenantSlug';
import { loadSavedLoginCredentials } from './loginCredentialsStorage';
import { resolveTenantSlugFromHost } from './tenantHostResolve';

const TENANT_SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{0,46}[a-z0-9])?$/;

export function normalizeTenantSlugForLinks(raw: string | null | undefined): string {
  const s = raw?.trim().toLowerCase() ?? '';
  return s && TENANT_SLUG_RE.test(s) ? s : '';
}

function loadPersistedLoginTenantSlug(): string {
  try {
    return normalizeTenantSlugForLinks(localStorage.getItem('sk_tenant_slug'));
  } catch {
    return '';
  }
}

/**
 * 공개·스태ff 링크용 tenant slug.
 * apex/www의 SK 기본 Host보다 로그인 세션·저장 slug를 우선한다.
 */
export function resolveTenantSlugForPublicLinks(opts?: {
  /** `/auth/me` tenant.slug — 스태ff가 고객 링크를 만들 때 최우선 */
  sessionTenantSlug?: string | null;
}): string {
  try {
    const q = normalizeTenantSlugForLinks(new URLSearchParams(window.location.search).get('tenant'));
    if (q) return q;
  } catch {
    /* ignore */
  }

  const session = normalizeTenantSlugForLinks(opts?.sessionTenantSlug);
  if (session) return session;

  const fromStorage = loadPersistedLoginTenantSlug();
  if (fromStorage) return fromStorage;

  const saved = normalizeTenantSlugForLinks(loadSavedLoginCredentials()?.tenantSlug);
  if (saved) return saved;

  const fromHostRaw = resolveTenantSlugFromHost(window.location.hostname);
  const fromHost = normalizeTenantSlugForLinks(fromHostRaw);
  if (fromHost && fromHost !== DEFAULT_TENANT_SLUG) return fromHost;

  if (fromHost === DEFAULT_TENANT_SLUG) return fromHost;

  return '';
}

/** 스태ff UI에서 고객에게 보낼 링크 — 세션 tenant 우선 */
export function resolveStaffTenantSlugForLinks(sessionTenantSlug?: string | null): string {
  return resolveTenantSlugForPublicLinks({ sessionTenantSlug });
}
