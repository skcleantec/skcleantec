/** CRM API·조회에 작업 브랜드 스코프 쿼리 부착 */
export function appendCrmWorkBrandQuery(
  params: URLSearchParams,
  operatingCompanyId?: string | null,
): void {
  const id = operatingCompanyId?.trim();
  if (id) params.set('operatingCompanyId', id);
}

export function crmWorkBrandQueryString(operatingCompanyId?: string | null): string {
  const params = new URLSearchParams();
  appendCrmWorkBrandQuery(params, operatingCompanyId);
  const q = params.toString();
  return q ? `?${q}` : '';
}

export const CRM_WORK_BRAND_SLUG_STORAGE_KEY = 'crmWorkBrandSlug';
