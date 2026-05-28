import { resolveInitialTenantSlug } from './tenantHostResolve';
import { loadSavedLoginCredentials } from './loginCredentialsStorage';

/** 공개 링크·API — Host / ?tenant= / localStorage / 로그인 저장 slug */
export function resolvePublicTenantSlug(): string {
  const initial = resolveInitialTenantSlug();
  if (initial) return initial;
  return loadSavedLoginCredentials()?.tenantSlug?.trim().toLowerCase() ?? '';
}

/** 고객 공개 URL·fetch 경로에 ?tenant=slug 추가 (slug 없으면 그대로) */
export function appendPublicTenantQuery(url: string, slug?: string | null): string {
  const s = (slug ?? resolvePublicTenantSlug()).trim().toLowerCase();
  if (!s) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}tenant=${encodeURIComponent(s)}`;
}
