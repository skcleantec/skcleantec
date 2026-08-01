/**
 * 타업체(외부업체·EXTERNAL_PARTNER) 기능 — SK클린텍·cbiseo 전용.
 * 서버 구현: server/src/modules/tenants/tenantFeatureCatalog.ts 와 동기화.
 */

export const EXTERNAL_COMPANY_TENANT_SLUGS = ['sk', 'skcleanteck', 'cbiseo'] as const;

export type ExternalCompanyTenantSlug = (typeof EXTERNAL_COMPANY_TENANT_SLUGS)[number];

export function isExternalCompanyTenantSlug(slug: string | null | undefined): boolean {
  const s = slug?.trim().toLowerCase();
  if (!s) return false;
  return (EXTERNAL_COMPANY_TENANT_SLUGS as readonly string[]).includes(s);
}

/** plan·플랫폼 오버라이드와 무관하게 slug 기준으로 mod_external_co 노출 여부 결정 */
export function applyExternalCompanyModuleAccess(
  modules: readonly string[],
  tenantSlug: string | null | undefined,
): string[] {
  if (isExternalCompanyTenantSlug(tenantSlug)) {
    const out = [...modules];
    if (!out.includes('mod_external_co')) out.push('mod_external_co');
    return out;
  }
  return modules.filter((m) => m !== 'mod_external_co');
}
