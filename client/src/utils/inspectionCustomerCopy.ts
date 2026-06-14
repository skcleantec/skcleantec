import { appendPublicQuery } from './publicTenantQuery';

/** 고객 현장 검수 완료본 공개 열람 URL */
export function getInspectionCustomerViewUrl(
  customerViewToken: string,
  origin?: string,
  tenantSlug?: string | null,
  brandSlug?: string | null,
): string {
  const base =
    origin ??
    (typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '');
  return appendPublicQuery(`${base}/inspection/${encodeURIComponent(customerViewToken)}`, {
    tenantSlug,
    brandSlug,
  });
}
