/** 서버·이메일용 공개 URL 빌더 */
import { getPublicAppBaseUrl } from '../../lib/publicAppBaseUrl.js';

export { getPublicAppBaseUrl };

export function buildInspectionCustomerViewUrl(
  customerViewToken: string,
  params?: { origin?: string; tenantSlug?: string | null; brandSlug?: string | null },
): string {
  const base = (params?.origin ?? getPublicAppBaseUrl()).replace(/\/$/, '');
  const path = `/inspection/${encodeURIComponent(customerViewToken)}`;
  const q = new URLSearchParams();
  if (params?.tenantSlug?.trim()) q.set('tenant', params.tenantSlug.trim());
  if (params?.brandSlug?.trim()) q.set('brand', params.brandSlug.trim());
  const qs = q.toString();
  return qs ? `${base}${path}?${qs}` : `${base}${path}`;
}
