import { resolveInitialTenantSlug } from './tenantHostResolve';
import { loadSavedLoginCredentials } from './loginCredentialsStorage';

/** 공개 링크·API — Host / ?tenant= / localStorage / 로그인 저장 slug */
export function resolvePublicTenantSlug(): string {
  const initial = resolveInitialTenantSlug();
  if (initial) return initial;
  return loadSavedLoginCredentials()?.tenantSlug?.trim().toLowerCase() ?? '';
}

/** 고객 공개 URL — `?brand=` (영업 브랜드 slug) */
export function resolvePublicBrandSlug(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return params.get('brand')?.trim().toLowerCase() ?? '';
}

/** 고객 공개 URL·fetch 경로에 ?tenant=slug 추가 (slug 없으면 그대로) */
export function appendPublicTenantQuery(url: string, slug?: string | null): string {
  const s = (slug ?? resolvePublicTenantSlug()).trim().toLowerCase();
  if (!s) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}tenant=${encodeURIComponent(s)}`;
}

/** 고객 공개 URL·fetch 경로에 ?brand=slug 추가 */
export function appendPublicBrandQuery(url: string, brandSlug?: string | null): string {
  const s = (brandSlug ?? resolvePublicBrandSlug()).trim().toLowerCase();
  if (!s) return url;
  const sep = url.includes('?') ? '&' : '?';
  return `${url}${sep}brand=${encodeURIComponent(s)}`;
}

/** tenant + brand 쿼리를 한 번에 붙임 */
export function appendPublicQuery(
  url: string,
  opts?: { tenantSlug?: string | null; brandSlug?: string | null },
): string {
  return appendPublicBrandQuery(appendPublicTenantQuery(url, opts?.tenantSlug), opts?.brandSlug);
}
