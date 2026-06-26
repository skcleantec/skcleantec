/** SK클린텍 테넌트 slug — `skcleanteck` 및 레거시 `sk` */
export const SK_TENANT_SLUGS = ['skcleanteck', 'sk'] as const;

export function isSkTenantSlug(slug: string | null | undefined): boolean {
  const s = slug?.trim().toLowerCase();
  return s === 'skcleanteck' || s === 'sk';
}
