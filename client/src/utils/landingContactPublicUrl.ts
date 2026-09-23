import { appendPublicQuery } from './publicTenantQuery';

export function getContactPublicUrl(
  origin?: string,
  tenantSlug?: string | null,
  brandSlug?: string | null,
): string {
  const base =
    origin ??
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');
  return appendPublicQuery(`${base}/contact`, { tenantSlug, brandSlug });
}

export function getContactShortUrl(origin: string | undefined, code: string): string {
  const base =
    origin ??
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');
  return `${base}/c/${encodeURIComponent(code)}`;
}
