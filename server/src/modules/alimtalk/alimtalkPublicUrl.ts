import { preferredPublicLinkTenantSlug } from '../../lib/publicLinkTenantSlug.js';

/** 솔라피 알림톡 템플릿 WL URL과 동일 형식 (도메인 고정) */
export function buildOrderFormAlimtalkPublicUrl(params: {
  token: string;
  tenantSlug: string;
  brandSlug?: string | null;
}): string {
  const tenant = preferredPublicLinkTenantSlug(params.tenantSlug);
  const brand = params.brandSlug?.trim() ?? '';
  const q = new URLSearchParams();
  if (tenant) q.set('tenant', tenant);
  if (brand) q.set('brand', brand);
  const qs = q.toString();
  return `https://www.cbiseo.com/order/${encodeURIComponent(params.token)}${qs ? `?${qs}` : ''}`;
}
