/**
 * 고객 공개 링크(?tenant=) — 로그인·복사 링크와 동일 slug.
 * SK 레거시: DB `skcleanteck` → URL `sk`
 */
export function preferredPublicLinkTenantSlug(dbSlug: string | null | undefined): string {
  const s = dbSlug?.trim().toLowerCase() ?? '';
  if (!s) return '';
  if (s === 'skcleanteck') return 'sk';
  return s;
}
