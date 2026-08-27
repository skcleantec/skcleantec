import { DEFAULT_TENANT_SLUG, LEGACY_SK_TENANT_SLUG } from '../modules/tenants/tenant.constants.js';

/** 고객 공개 링크(?tenant=) — 로그인·복사 링크와 동일 slug */
export function preferredPublicLinkTenantSlug(dbSlug: string | null | undefined): string {
  const s = dbSlug?.trim().toLowerCase() ?? '';
  if (!s) return '';
  if (s === DEFAULT_TENANT_SLUG) return LEGACY_SK_TENANT_SLUG;
  return s;
}
