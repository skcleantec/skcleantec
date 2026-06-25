import { resolveTenantSlugForPublicLinks } from './staffTenantSlugForLinks';

/** 공개 링크·API — ?tenant= / 세션·저장 slug / Host (apex SK는 마지막) */
export function resolvePublicTenantSlug(sessionTenantSlug?: string | null): string {
  return resolveTenantSlugForPublicLinks({ sessionTenantSlug });
}

/** 고객 공개 URL — `?brand=` (영업 브랜드 slug) */
export function resolvePublicBrandSlug(): string {
  if (typeof window === 'undefined') return '';
  const params = new URLSearchParams(window.location.search);
  return params.get('brand')?.trim().toLowerCase() ?? '';
}

/** 고객 공개 URL·fetch 경로에 ?tenant=slug 추가 (slug 없으면 그대로) */
export function appendPublicTenantQuery(
  url: string,
  slug?: string | null,
  opts?: { sessionTenantSlug?: string | null },
): string {
  const s = (slug ?? resolvePublicTenantSlug(opts?.sessionTenantSlug)).trim().toLowerCase();
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
  opts?: {
    tenantSlug?: string | null;
    brandSlug?: string | null;
    sessionTenantSlug?: string | null;
  },
): string {
  return appendPublicBrandQuery(
    appendPublicTenantQuery(url, opts?.tenantSlug, { sessionTenantSlug: opts?.sessionTenantSlug }),
    opts?.brandSlug,
  );
}
